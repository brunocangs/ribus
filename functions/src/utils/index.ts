import axios from "axios";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "defender-relay-client/lib/ethers";
import { ethers } from "ethers";
import { defaultPath, HDNode } from "ethers/lib/utils";
import { credential } from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getFunctions, TaskOptions } from "firebase-admin/functions";
import { logger } from "firebase-functions";
import { sign } from "jsonwebtoken";
import { hardhatWallet } from "../../../solidity/src/lib/utils";
import devServiceAccount from "../../service-account.dev.json";
import prodServiceAccount from "../../service-account.prod.json";

const ENV = process.env.NODE_ENV;
const isLocal = ENV === "development";

const serviceAccount =
  ENV === "production" ? prodServiceAccount : devServiceAccount;

export const app = initializeApp({
  credential: credential.cert(serviceAccount as any),
});

export const getSeed = () => {
  const seed = process.env.SEED;
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
      console.log({ url });
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

export const getDefenderCredentials = () => ({
  apiKey: process.env.DEFENDER_API_KEY as string,
  apiSecret: process.env.DEFENDER_API_SECRET as string,
});

export const getProvider = () => {
  switch (ENV) {
    case "staging":
      return new DefenderRelayProvider(getDefenderCredentials());
    case "production":
      return new ethers.providers.InfuraProvider(
        "matic",
        process.env.INFURA_PROJECT_ID
      );
    default:
      return new ethers.providers.JsonRpcProvider();
  }
};

export const getSigner = () => {
  switch (ENV) {
    case "staging":
      return new DefenderRelaySigner(getDefenderCredentials(), getProvider(), {
        speed: "fast",
      });
    case "production":
      return getChildWallet("0");
    default:
      return hardhatWallet.connect(getProvider());
  }
};

export const signToken = (data: any, id: string, expire = false) => {
  const opts: any = {
    issuer: "app.ribus.com.br",
    algorithm: "HS256",
    jwtid: id,
  };
  if (expire) opts["expiresIn"] = "2h";
  console.log(process.env.JWT_SECRET);
  return sign(data, process.env.JWT_SECRET as string, opts);
};

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
