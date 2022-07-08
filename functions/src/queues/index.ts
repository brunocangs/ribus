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
  getChildWallet,
  getProvider,
  getSigner,
  postFeedback,
  sendRelayRequest,
  signToken,
  taskQueue,
} from "../utils";

const deploy = d as any;

const secrets = ["SEED", "JWT_SECRET"];

type TaskData = {
  from: string;
  jwt: string;
  jwtPayload: RibusTransferJWT;
};

export const firstTransfer = functions
  .runWith({
    secrets,
  })
  .tasks.taskQueue({
    rateLimits: {
      maxConcurrentDispatches: 15,
    },
    retryConfig: {
      maxAttempts: 3,
    },
  })
  .onDispatch(async (data: TaskData) => {
    console.log(`First task`);
    const provider = getProvider();
    const signer = getSigner();
    const { jwtPayload, from } = data;
    const firestore = getFirestore();
    const requestRef = firestore
      .collection("claim_requests")
      .doc(jwtPayload.jti);

    try {
      const network = await provider.getNetwork();
      const tokenContract = new ethers.Contract(
        deploy[chainIdToName[network.chainId]].token,
        TokenAbi,
        signer
      ) as RibusToken;
      const child = await getChildWallet(jwtPayload.user_id.toString());
      let request = await tokenContract.populateTransaction.transferFrom(
        from,
        child.address,
        jwtPayload.amount
      );
      const estimate = await provider.send(`eth_estimateGas`, [request]);
      const tx = await sendRelayRequest({
        ...request,
        gasLimit: ethers.BigNumber.from(estimate),
      });
      await tx.wait(1);
      await requestRef.set(
        {
          first_hash: tx.hash,
          second_hash: null,
          status: "PROCESSING",
        },
        {
          merge: true,
        }
      );
      const secondTask = taskQueue("secondTransfer");
      await secondTask({
        ...data,
        hash: tx.hash,
      });
    } catch (err: any) {
      functions.logger.error(err);
      requestRef.set(
        {
          status: "ERROR",
        },
        {
          merge: true,
        }
      );
      postFeedback(
        signToken(
          {
            status: "ERROR",
            message: `Falha ao dar claim em RIB: ${err.message}`,
          },
          jwtPayload.jti
        )
      );
    }
  });

export const secondTransfer = functions
  .runWith({
    secrets: secrets,
  })
  .tasks.taskQueue({
    rateLimits: {
      maxConcurrentDispatches: 15,
    },
    retryConfig: {
      maxAttempts: 3,
    },
  })
  .onDispatch(async (data: TaskData & { hash: string }) => {
    console.log(`Second task`);
    const { jwtPayload, hash } = data;
    const firestore = getFirestore();
    const requestRef = firestore
      .collection("claim_requests")
      .doc(jwtPayload.jti);
    try {
      const provider = getProvider();
      const signer = getSigner();
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
      const child = await getChildWallet(jwtPayload.user_id.toString());
      const { request, signature } = await signMetaTxRequest(
        child.privateKey,
        forwarder,
        {
          data: tokenContract.interface.encodeFunctionData("transfer", [
            jwtPayload.wallet,
            jwtPayload.amount,
          ]),
          from: child.address,
          to: tokenContract.address,
        }
      );
      const populated = await forwarder.populateTransaction.execute(
        request,
        signature
      );
      const estimate = await provider.send(`eth_estimateGas`, [populated]);
      const secondTx = await sendRelayRequest({
        ...populated,
        gasLimit: ethers.BigNumber.from(estimate),
      });
      await secondTx.wait(1);
      await requestRef.set(
        {
          second_hash: secondTx.hash,
          status: "SUCCESS",
          message: "Claim realizado com sucesso",
        },
        {
          merge: true,
        }
      );
      postFeedback(
        signToken(
          {
            first_hash: hash,
            second_hash: secondTx.hash,
            status: "SUCCESS",
            message: "Claim realizado com sucesso",
          },
          jwtPayload.jti
        )
      );
    } catch (err: any) {
      functions.logger.error(err);
      requestRef.set(
        {
          status: "ERROR",
          message: `Falha ao dar claim em RIB: ${err.message}`,
        },
        {
          merge: true,
        }
      );
      postFeedback(
        signToken(
          {
            status: "ERROR",
            message: `Falha ao dar claim em RIB: ${err.message}`,
          },
          jwtPayload.jti
        )
      );
    }
  });
