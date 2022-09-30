import axios from "axios";
import { ethers } from "ethers";
import { defaultPath, HDNode } from "ethers/lib/utils";
import { credential } from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getFunctions, TaskOptions } from "firebase-admin/functions";
import { logger } from "firebase-functions";
import { sign } from "jsonwebtoken";
import { State } from "xstate";
import { abi as ForwarderAbi } from "../../../solidity/artifacts/@openzeppelin/contracts-upgradeable/metatx/MinimalForwarderUpgradeable.sol/MinimalForwarderUpgradeable.json";
import { abi as TokenAbi } from "../../../solidity/artifacts/src/contracts/RibusTokenV2.sol/RibusTokenV2.json";
import d from "../../../solidity/deploy.json";
import { chainIdToName } from "../../../solidity/src/lib/utils";
import { RibusTransferJWT } from "../../../solidity/src/types";
import {
  MinimalForwarderUpgradeable,
  RibusTokenV2,
} from "../../../solidity/typechain";
import devServiceAccount from "../../service-account.dev.json";
import prodServiceAccount from "../../service-account.prod.json";
import {
  txMachine,
  TxModelContext,
  TxModelEvents,
} from "../machines/transaction.machine";
const deploy = d as any;

const ENV = process.env.NODE_ENV;
const isLocal = ENV === "development";

const serviceAccount =
  ENV === "production" ? prodServiceAccount : devServiceAccount;

export const app = initializeApp({
  credential: credential.cert(serviceAccount as any),
});
export const firestore = getFirestore(app);

export const getSeed = () => {
  let seed = process.env.SEED;
  // hardhat seed if dev
  if (ENV === "development")
    seed = ethers.utils.mnemonicToSeed(
      "test test test test test test test test test test test junk"
    );
  if (!seed) throw new Error(`Missing secrets`);
  return seed;
};

export const postFeedback = async (token: any) => {
  console.log(`postFeedback - Posting to ${process.env.FEEDBACK_SERVER_URL}`, {
    token,
  });
  const [, content] = token.split(".");
  const jwtPayload = JSON.parse(Buffer.from(content, "base64").toString());

  const firestore = getFirestore();
  const requestRef = firestore.collection("claim_requests").doc(jwtPayload.jti);
  try {
    const req = await axios.post(
      process.env.FEEDBACK_SERVER_URL as string,
      JSON.stringify({ token }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    requestRef.set(
      {
        synced: true,
      },
      { merge: true }
    );
    return req;
  } catch (err) {
    requestRef.set(
      {
        synced: false,
      },
      { merge: true }
    );
    logger.error(`Errored sending feedback`, { err });
    return;
  }
};

export const taskQueue = (taskName: string) => {
  const { FUNCTION_EMULATOR_HOST = "localhost:5001", REGION = "us-central1" } =
    process.env;
  if (isLocal) {
    return async (data: Record<string, any>, opts?: any) => {
      const url = `http://${FUNCTION_EMULATOR_HOST}/${serviceAccount.project_id}/${REGION}/${taskName}`;
      await axios.post(url, JSON.stringify({ data }), {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer blep",
        },
      });
    };
  } else {
    return (data: Record<string, any>, opts?: TaskOptions | undefined) => {
      const queue = getFunctions(app).taskQueue(taskName);
      return queue.enqueue(data, opts);
    };
  }
};

export const getRootNode = () => HDNode.fromSeed(getSeed());

export const getPath = (index: string) => {
  return defaultPath.replace(/\d$/, index);
};

export const getChildNode = (index: string) =>
  getRootNode().derivePath(getPath(index));

export const getChildWallet = (
  index: string,
  provider: ethers.providers.JsonRpcProvider = getProvider()
) => new ethers.Wallet(getChildNode(index).privateKey, provider);

export const getRootWallet = () => getChildWallet("0");

export const getDefenderCredentials = () => ({
  apiKey: process.env.DEFENDER_API_KEY as string,
  apiSecret: process.env.DEFENDER_API_SECRET as string,
});

export const getProvider = () => {
  switch (ENV) {
    case "staging":
      return new ethers.providers.InfuraProvider(
        "maticmum",
        process.env.INFURA_PROJECT_ID
      );
    case "production":
      return new ethers.providers.InfuraProvider(
        "matic",
        process.env.INFURA_PROJECT_ID
      );
    default:
      return new ethers.providers.JsonRpcProvider();
  }
};

export const getContracts = async () => {
  const network = await getNetwork();
  const networkName = chainIdToName[network.chainId];
  if (!networkName) throw new Error(`Problem loading network from provider`);
  const addresses = deploy[networkName];
  if (!addresses) throw new Error(`No addresses found for ${networkName}`);
  return {
    forwarder: new ethers.Contract(
      addresses.forwarder,
      ForwarderAbi,
      getSigner()
    ) as MinimalForwarderUpgradeable,
    token: new ethers.Contract(
      addresses.token,
      TokenAbi,
      getSigner()
    ) as RibusTokenV2,
  };
};

export const getNetwork = () => getProvider().getNetwork();

export const getSigner = () => {
  switch (ENV) {
    // case "staging":
    //   return new DefenderRelaySigner(getDefenderCredentials(), getProvider(), {
    //     speed: "fast",
    //   });
    // case "production":
    default:
      return getChildWallet("0");
  }
};

export const signToken = (data: any, id: string, expire = false) => {
  const opts: any = {
    issuer: "app.ribus.com.br",
    algorithm: "HS256",
    jwtid: id,
  };
  if (expire) opts["expiresIn"] = "2h";
  return sign(data, process.env.JWT_SECRET as string, opts);
};

// Infura relay
export const signRequest = async (tx: any) => {
  const provider = getProvider();
  await provider._networkPromise;
  const network = provider._network;
  const relayTransactionHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "bytes", "uint", "uint", "string"],
      [tx.to, tx.data, tx.gas, network.chainId, tx.schedule]
    )
  );
  return await getSigner().signMessage(
    ethers.utils.arrayify(relayTransactionHash)
  );
};

interface Transaction {
  hash: string;
  wait(
    confirmations?: number
  ): Promise<ethers.ContractReceipt | { infuraHash: string }>;
}

export const sendRelayRequest = async (
  tx: ethers.PopulatedTransaction
): Promise<Transaction> => {
  const wallet = getSigner();
  const provider = wallet.provider as ethers.providers.JsonRpcProvider;
  if (ENV !== "production") {
    return wallet.sendTransaction(tx);
  } else {
    const gasLimit = tx.gasLimit as ethers.BigNumber | undefined;
    const txObj = {
      to: tx.to,
      data: tx.data,
      gas: gasLimit?.mul(105).div(100).toString() || (1e6).toString(),
      schedule: "fast",
    };
    const signature = await signRequest(txObj);
    return provider
      .send("relay_sendTransaction", [txObj, signature])
      .then((result) => new ITXTransaction(result.relayTransactionHash));
  }
};

const wait = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds)).catch(
    (err) => {
      logger.error(err);
    }
  );
};

class ITXTransaction implements Transaction {
  minedTxHash?: string;
  relayTransactionHash: string;
  constructor(relayTransactionHash: string) {
    this.relayTransactionHash = relayTransactionHash;
  }
  get hash() {
    if (this.minedTxHash) return this.minedTxHash;
    return this.relayTransactionHash;
  }
  async wait(confirmations = 1) {
    const provider = getProvider();
    let retries = 0;
    while (true) {
      // fetches an object
      // { receivedTime: string, broadcasts?: [{broadcastTime: string, ethTxHash: string, gasPrice: string}]}
      let broadcasts = [] as any[];
      try {
        retries++;
        const result = await provider.send("relay_getTransactionStatus", [
          this.relayTransactionHash,
        ]);
        broadcasts = result.broadcasts;
      } catch (err) {
        await wait(1000);
        logger.warn(`Infura call failed, retrying`, {
          infuraHash: this.relayTransactionHash,
          retries,
        });
        if (retries < 50) {
          continue;
        } else {
          return {
            infuraHash: this.relayTransactionHash,
          };
        }
      }

      // check each of these hashes to see if their receipt exists and
      // has confirmations
      if (broadcasts) {
        for (const broadcast of broadcasts) {
          const { ethTxHash } = broadcast;
          const receipt = await provider.getTransactionReceipt(ethTxHash);

          if (
            receipt &&
            receipt.confirmations &&
            receipt.confirmations >= confirmations
          ) {
            // The transaction is now on chain!
            logger.debug(
              `Ethereum transaction hash: ${receipt.transactionHash}`
            );
            logger.debug(`Mined in block ${receipt.blockNumber}`);
            this.minedTxHash = receipt.transactionHash;
            return receipt;
          }
        }
      }
      await wait(200);
    }
  }
}

// State Machine <> JSON

export const serialize = <TAny>(state: TAny) =>
  JSON.parse(JSON.stringify(state));

export const hydrate = (state: any) =>
  State.create<TxModelContext, TxModelEvents>(state);

// Firebase transactions
export const txsRef = firestore.collection("claim_requests");

export const createTx = (data: any) =>
  txsRef.add({
    ...data,
    state: serialize(txMachine.initialState),
  });

export const saveTx = (txId: string, data: { state: any } & any) =>
  txsRef
    .doc(txId)
    .set({ ...data, state: serialize(data.state) }, { merge: true });

export const getTx = (txId: string) =>
  txsRef
    .doc(txId)
    .get()
    .then((snap) => {
      if (!snap.exists) return null;
      const snapshotData = snap.data();
      if (!snapshotData) return null;
      const { state, ...data } = snapshotData;
      return {
        ...data,
        state: state ? hydrate(state) : null,
        id: snap.id,
      } as MachineTransaction;
    });

export const getTxs = () =>
  txsRef.get().then((snap) => {
    if (snap.empty) return [];
    return snap.docs
      .map((doc) => {
        if (!doc.exists) return null;
        const docData = doc.data();
        if (!docData) return null;
        return {
          ...docData,
          id: doc.id,
          state: docData.state ? hydrate(docData.state) : null,
        } as MachineTransaction;
      })
      .filter(Boolean) as MachineTransaction[];
  });

export const getNonce = async (userId: number) => {
  const allNonces = await Promise.all([
    txsRef
      .where("user_id", "==", userId.toString())
      .orderBy("nonce", "desc")
      .limit(1)
      .get()
      .then((snap) => {
        if (snap.empty) return null;
        const [firstSnap] = snap.docs;
        const first = firstSnap.data();
        // next nonce = Last nonce + 1
        return first.nonce + 1;
      }),
    getProvider().getTransactionCount(
      // This will always be next nonce
      getChildWallet(userId.toString()).address
    ),
  ]);
  console.log({
    userId,
    allNonces,
  });
  return Math.max(...allNonces);
};

export const getTxsByUser = () =>
  txsRef
    .where("state.done", "!=", true)
    // .orderBy("user_id", "asc")
    // .orderBy("nonce", "asc")
    .get()
    .then((snap) => {
      if (snap.empty) return [];
      return snap.docs
        .map((docSnap) => {
          const docData = docSnap.data();
          return {
            ...docData,
            id: docSnap.id,
            state: docData.state ? hydrate(docData.state) : null,
          };
        })
        .filter(Boolean) as MachineTransaction[];
    });

export const getUserTxs = (userId: number) =>
  txsRef
    .where("jwt.user_id", "==", userId)
    .orderBy("nonce", "asc")
    .get()
    .then((snap) => {
      if (snap.empty) return [];
      return snap.docs
        .map((doc) => {
          if (!doc.exists) return null;
          const docData = doc.data();
          if (!docData) return null;
          return {
            ...docData,
            id: doc.id,
            state: docData.state ? hydrate(docData.state) : null,
          } as MachineTransaction;
        })
        .filter(Boolean) as MachineTransaction[];
      // .sort((a, b) => {
      //   if (!a?.nonce) return -1;
      //   if (!b?.nonce) return 1;
      //   return a.nonce - b.nonce;
      // })
    });

export type MachineTransaction = {
  hash?: string;
  id: string;
  user_id: string;
  to: string;
  data: string;
  state: typeof txMachine.initialState | null;
  nonce: number;
  jwt?: RibusTransferJWT;
  version?: number;
};

// Firebase locks

type TxLock = {
  locked: boolean;
  lockedAt: Date | null;
  id: string;
};

export const locksRef = firestore.collection("tx_locks");

export const getLock = (lockId: string) =>
  locksRef
    .doc(lockId)
    .get()
    .then((snap) => {
      if (!snap.exists) return null;
      const snapData = snap.data();
      if (!snapData) return null;
      if (snapData.lockedAt) {
        const lockedAt = snapData.lockedAt as Timestamp | undefined;
        if (lockedAt) {
          // If locked for over 70 seconds => Cloud function timed out
          logger.debug(
            `Interval`,
            Date.now() - lockedAt.toMillis() > 60 * 1000
          );
          if (Date.now() - lockedAt.toMillis() > 60 * 1000) {
            return {
              id: snap.id,
              locked: false,
              lockedAt: null,
            } as TxLock;
          }
        }
      }
      return {
        ...snapData,
        id: snap.id,
        lockedAt: snapData.lockedAt ? snapData.lockedAt.toDate() : null,
      } as TxLock;
    });

export const setLocked = (lockId: string, locked: boolean) =>
  locksRef.doc(lockId).set(
    {
      locked,
      lockedAt: locked ? Timestamp.fromDate(new Date()) : null,
    },
    {
      merge: true,
    }
  );
