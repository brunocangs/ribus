import * as ethers from "ethers";
import { logger } from "firebase-functions";
import { signMetaTxRequest } from "../../../solidity/src/lib/signer_node";
import { getChildWallet, getContracts, getProvider, getSigner } from "../utils";
import {
  getLock,
  MachineTransaction,
  saveTx,
  setLocked,
} from "./../utils/index";
import { txMachine } from "./transaction.machine";

// Mocks
const provider = getProvider();

const PENDING_LOCK = "pending";

export const processPending = async (txs: MachineTransaction[]) => {
  const lock = await getLock(PENDING_LOCK);
  // logger.debug({
  //   lock: PENDING_LOCK,
  //   value: lock,
  // });
  if (lock && lock.locked) return;
  await setLocked(PENDING_LOCK, true);
  try {
    const { forwarder } = await getContracts();
    // Group txs by user for nonce management
    const sortedTxs = txs
      .sort((a, b) => {
        if (!a.user_id) return -1;
        if (!b.user_id) return 1;
        return +a.user_id - +b.user_id;
      })
      .filter((t) => !!t.user_id);

    let executerNonce = await getSigner().getTransactionCount();
    let lastUserId = "-1";
    let lastUserWallet = getChildWallet("0");
    let lastUserNonce = ethers.BigNumber.from(0);
    const signer = getSigner();
    for (const tx of sortedTxs) {
      const { state, ...txData } = tx;
      if (!state || !state.matches("pending")) continue;
      // If moved to another user, update info
      try {
        if (lastUserId !== tx.user_id) {
          lastUserId = tx.user_id;
          lastUserWallet = getChildWallet(tx.user_id.toString());
          const address = await lastUserWallet.getAddress();
          lastUserNonce = await forwarder.getNonce(address);
        }
        // Sign meta tx as wallet
        const { request, signature } = await signMetaTxRequest(
          lastUserWallet.privateKey,
          forwarder,
          {
            to: txData.to,
            data: txData.data,
            from: await lastUserWallet.getAddress(),
            nonce: lastUserNonce.toString(),
          }
        );
        lastUserNonce = lastUserNonce.add(1);

        const feeData = await provider.getFeeData();
        const populatedTx = await forwarder.populateTransaction.execute(
          request,
          signature
        );
        const gasEstimate = await forwarder.estimateGas.execute(
          request,
          signature
        );
        const transaction = await signer.sendTransaction({
          ...populatedTx,
          gasPrice: feeData.gasPrice?.mul(120).div(100) || 0,
          gasLimit: gasEstimate,
        });
        console.log(`Executed ${transaction.hash}`);
        executerNonce++;
        await saveTx(tx.id, {
          ...tx,
          hash: transaction.hash,
          state: txMachine.transition(state, "submitted"),
        });
        await transaction.wait(1);
      } catch (err: any) {
        logger.error(`Errored processing pending txs`, {
          executerNonce,
          lastUserNonce,
          err,
        });
        await saveTx(tx.id, {
          ...tx,
          state: tx.state ? txMachine.transition(tx.state, "errored") : null,
        });
      }
    }
  } catch (err) {
    logger.error(`Errored processPending`, { err });
  } finally {
    // logger.debug(`Clearing lock`, { lock: PENDING_LOCK });
    await setLocked(PENDING_LOCK, false);
  }
};

const PROCESSING_LOCK = "processing";

export const processProcessing = async (txs: MachineTransaction[]) => {
  const lock = await getLock(PROCESSING_LOCK);
  // logger.debug({
  //   lock: PROCESSING_LOCK,
  //   value: lock,
  // });
  if (lock && lock.locked) return;
  try {
    await Promise.all(
      txs.map(async (tx) => {
        if (tx.hash && tx.state?.matches("processing")) {
          try {
            const receit = await provider.getTransactionReceipt(tx.hash);
            let nextState: MachineTransaction["state"];
            if (
              receit.confirmations > 0 &&
              receit.status === 1 &&
              receit.logs.length > 0
            ) {
              nextState = txMachine.transition(tx.state, {
                type: "mined",
                hash: tx.hash,
              });
            } else {
              nextState = txMachine.transition(tx.state, "rejected");
            }
            return saveTx(tx.id, {
              ...tx,
              state: nextState,
            });
          } catch (err) {
            logger.error(`Failed to get receit`);
          }
        }
        return;
      })
    );
  } catch (err) {
    logger.error(`Errored processProcessing`, { err });
  }
  await setLocked(PROCESSING_LOCK, false);
  // logger.debug(`Clearing lock`, { lock: PROCESSING_LOCK });
};

const FAILED_LOCK = "failed";
export const processFailed = async (txs: MachineTransaction[]) => {
  const lock = await getLock(FAILED_LOCK);
  // logger.debug({
  //   lock: FAILED_LOCK,
  //   value: lock,
  // });
  if (lock && lock.locked) return;
  try {
    await Promise.all(
      txs.map(async (tx) => {
        if (tx.state?.matches("failed") && tx.state.context.retries < 50) {
          return saveTx(tx.id, {
            ...tx,
            state: txMachine.transition(tx.state, "adjusted"),
          });
        } else {
          return tx;
        }
      })
    );
  } catch (err) {
    logger.error(`Errored processFailed`, { err });
  }
  await setLocked(FAILED_LOCK, false);
  // logger.debug(`Clearing lock`, { lock: FAILED_LOCK });
};
