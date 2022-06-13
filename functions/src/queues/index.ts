import { ethers } from "ethers";
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
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
import { getChildWallet, getProvider, getSigner, taskQueue } from "../utils";
const deploy = d as any;

export const requiredSecrets = ["SEED"];

type TaskData = {
  from: string;
  jwt: string;
  jwtPayload: RibusTransferJWT;
};

export const firstTransfer = functions
  .runWith({
    secrets: requiredSecrets,
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
    const network = await provider._networkPromise;
    const { jwtPayload, from, jwt } = data;
    const tokenContract = new ethers.Contract(
      deploy[chainIdToName[network.chainId]].token,
      TokenAbi
    ).connect(signer) as unknown as RibusToken;
    const child = await getChildWallet(jwtPayload.user_id.toString());
    let tx = await tokenContract.transferFrom(
      from,
      child.address,
      jwtPayload.amount
    );
    const firstTx = await provider.getTransaction(tx.hash);
    const firestore = getFirestore();
    const requestRef = firestore
      .collection("claim_requests")
      .doc(jwtPayload.jti);
    await requestRef.set(
      {
        firstTxHash: firstTx.hash,
        secondTxHash: null,
      },
      {
        merge: true,
      }
    );
    const secondTask = taskQueue("secondTransfer");
    await secondTask({
      ...data,
      hash: firstTx.hash,
    });
  });

export const secondTransfer = functions
  .runWith({
    secrets: requiredSecrets,
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
    const provider = getProvider();
    const firstActionTx = await provider.getTransaction(hash);
    await firstActionTx.wait();

    const signer = getSigner();
    const network = await provider._networkPromise;
    const tokenContract = new ethers.Contract(
      deploy[chainIdToName[network.chainId]].token,
      TokenAbi
    ).connect(signer) as unknown as RibusToken;
    const forwarder = new ethers.Contract(
      deploy[chainIdToName[network.chainId]].forwarder,
      ForwarderAbi,
      signer
    ) as unknown as MinimalForwarderUpgradeable;
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
    const secondTx = await forwarder.execute(request, signature);
    await secondTx.wait(1);
    await requestRef.set(
      {
        secondTxHash: secondTx.hash,
      },
      {
        merge: true,
      }
    );
    console.log({ firstHash: data.hash, secondHash: secondTx.hash });
  });
