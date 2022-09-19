import { ethers } from "ethers";
import { getFirestore } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import { abi as TokenAbi } from "../../../solidity/artifacts/src/contracts/RibusToken.sol/RibusToken.json";
import { abi as ForwarderAbi } from "../../../solidity/artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import d from "../../../solidity/deploy.json";
import { signMetaTxRequest } from "../../../solidity/src/lib/signer_node";
import { chainIdToName } from "../../../solidity/src/lib/utils";
import { RibusTransferJWT } from "../../../solidity/src/types";
import {
  MinimalForwarderUpgradeable,
  RibusToken,
} from "../../../solidity/typechain";
import {
  app,
  getChildWallet,
  getProvider,
  getRootWallet,
  getSigner,
  sendRelayRequest,
} from "../utils";

const deploy = d as any;

const secrets = ["SEED", "JWT_SECRET"];

type TaskData<T> = {
  from: string;
  jwt: string;
  jwtPayload: T;
};

export const firstTransfer = functions
  .runWith({
    secrets,
  })
  .tasks.taskQueue({
    rateLimits: {
      maxConcurrentDispatches: 1,
    },
    retryConfig: {
      maxAttempts: 1,
    },
  })
  .onDispatch(async (data: TaskData<RibusTransferJWT>) => {
    functions.logger.info(`First task`);
    const provider = getProvider();
    const signer = getSigner();
    const { jwtPayload } = data;
    const firestore = getFirestore(app);
    const requestRef = firestore
      .collection("claim_requests")
      .doc(jwtPayload.jti);

    // Pull data from JWT
    // Who is sending => Internal or external
    let sender: string;
    if (jwtPayload.from_user_id !== undefined) {
      sender = await getChildWallet(
        jwtPayload.from_user_id.toString()
      ).getAddress();
    } else if (jwtPayload.from_wallet !== undefined) {
      sender = jwtPayload.from_wallet;
    } else throw new Error("Missing sender information");

    // Who is receiving => Internal or external
    let receiver: string;
    if (jwtPayload.to_user_id !== undefined) {
      receiver = await getChildWallet(
        jwtPayload.to_user_id.toString()
      ).getAddress();
    } else if (jwtPayload.to_wallet !== undefined) {
      receiver = jwtPayload.to_wallet;
    } else throw new Error("Missing receiver information");

    try {
      const network = await provider.getNetwork();
      const tokenContract = new ethers.Contract(
        deploy[chainIdToName[network.chainId]].token,
        TokenAbi,
        signer
      ) as RibusToken;
      const forwarder = new ethers.Contract(
        deploy[chainIdToName[network.chainId]].forwarder,
        ForwarderAbi,
        signer
      ) as MinimalForwarderUpgradeable;
      const isInternal = jwtPayload.from_user_id !== undefined;
      // If there's no from_user_id, sign metaTx as root
      const signerPk = isInternal
        ? getChildWallet(jwtPayload.from_user_id?.toString() ?? "0").privateKey
        : getRootWallet().privateKey;
      // If there's from_user_id, tx `from` and signer must be child wallet
      const from = isInternal ? sender : await getRootWallet().getAddress();
      const data = isInternal
        ? // If there's from_user_id, tx data will be transfer from self
          tokenContract.interface.encodeFunctionData("transfer", [
            receiver,
            jwtPayload.amount,
          ])
        : // If there's from_wallet, tx will be transferFrom as third party
          tokenContract.interface.encodeFunctionData("transferFrom", [
            sender,
            receiver,
            jwtPayload.amount,
          ]);

      const { request, signature } = await signMetaTxRequest(
        signerPk,
        forwarder,
        {
          to: tokenContract.address,
          from,
          data,
        }
      );
      const populated = await forwarder.populateTransaction.execute(
        request,
        signature
      );
      const estimate = await provider.send(`eth_estimateGas`, [populated]);
      const txRequest = {
        ...populated,
        gasLimit: ethers.BigNumber.from(estimate),
      };
      const tx = await sendRelayRequest(txRequest);
      functions.logger.debug(`First Queue Transaction`, tx);
      try {
        const result = await tx.wait(1);
        if ("infuraHash" in result) {
          await requestRef.set(
            {
              infuraHash: result.infuraHash,
              status: "WAITING",
              message: "Aguardando confirmaçao",
            },
            {
              merge: true,
            }
          );
          return;
        } else {
          await requestRef.set(
            {
              hash: result.transactionHash,
              status: "SUCCESS",
              message: "Claim realizado com sucesso",
            },
            {
              merge: true,
            }
          );
        }
      } catch (err) {
        functions.logger.warn(err);
        await requestRef.set(
          {
            status: "WAITING",
            message: "Aguardando confirmaçao",
          },
          {
            merge: true,
          }
        );
      }
    } catch (err: any) {
      functions.logger.error(err);
      requestRef.set(
        {
          status: "ERROR",
          message: `Falha ao transferir RIB: ${err.message}`,
        },
        {
          merge: true,
        }
      );
    }
  });
