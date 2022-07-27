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
  getSigner,
  sendRelayRequest,
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
      maxConcurrentDispatches: 1,
    },
    retryConfig: {
      maxAttempts: 1,
    },
  })
  .onDispatch(async (data: TaskData) => {
    functions.logger.info(`First task`);
    const provider = getProvider();
    const signer = getSigner();
    const { jwtPayload, from } = data;
    const firestore = getFirestore(app);
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
      const forwarder = new ethers.Contract(
        deploy[chainIdToName[network.chainId]].forwarder,
        ForwarderAbi,
        signer
      ) as MinimalForwarderUpgradeable;
      const { request, signature } = await signMetaTxRequest(
        getChildWallet("0").privateKey,
        forwarder,
        {
          to: tokenContract.address,
          from: await signer.getAddress(),
          data: tokenContract.interface.encodeFunctionData("transferFrom", [
            from,
            jwtPayload.wallet,
            jwtPayload.amount,
          ]),
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
              // first_hash: tx.hash,
              // second_hash: tx.hash,
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
              first_hash: result.transactionHash,
              second_hash: result.transactionHash,
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
            // first_hash: tx.hash,
            // second_hash: tx.hash,
            status: "WAITING",
            message: "Aguardando confirmaçao",
          },
          {
            merge: true,
          }
        );
      }
      // const secondTask = taskQueue("secondTransfer");
      // await secondTask({
      //   ...data,
      //   hash: tx.hash,
      // });
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
      // postFeedback(
      //   signToken(
      //     {
      //       status: "ERROR",
      //       message: `Falha ao dar claim em RIB: ${err.message}`,
      //     },
      //     jwtPayload.jti
      //   )
      // );
    }
  });

export const secondTransfer = functions
  .runWith({
    secrets: secrets,
  })
  .tasks.taskQueue({
    rateLimits: {
      maxConcurrentDispatches: 1,
    },
    retryConfig: {
      maxAttempts: 3,
    },
  })
  .onDispatch(async (data: TaskData & { hash: string }) => {
    functions.logger.info(`Second task`);
    const { jwtPayload, hash } = data;
    const firestore = getFirestore(app);
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
      const txRequest = {
        ...populated,
        gasLimit: ethers.BigNumber.from(estimate),
      };
      functions.logger.debug(`Second Queue Transaction`, txRequest);

      const secondTx = await sendRelayRequest(txRequest);
      await secondTx.wait(1);
      const result = await requestRef.set(
        {
          second_hash: secondTx.hash,
          status: "SUCCESS",
          message: "Claim realizado com sucesso",
        },
        {
          merge: true,
        }
      );

      functions.logger.debug(`Should have logged this in queue firstTransfer`, {
        result,
      });
      // postFeedback(
      //   signToken(
      //     {
      //       first_hash: hash,
      //       second_hash: secondTx.hash,
      //       status: "SUCCESS",
      //       message: "Claim realizado com sucesso",
      //     },
      //     jwtPayload.jti
      //   )
      // );
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
      // postFeedback(
      //   signToken(
      //     {
      //       status: "ERROR",
      //       message: `Falha ao dar claim em RIB: ${err.message}`,
      //     },
      //     jwtPayload.jti
      //   )
      // );
    }
  });
