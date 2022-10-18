import * as functions from "firebase-functions";
import groupBy from "lodash.groupby";
import {
  processFailed,
  processPending,
  processProcessing,
} from "../machines/handlers";
import { getTxsByUser, MachineTransaction } from ".";

export async function processTxs() {
  const txs = await getTxsByUser();
  const byUser = Object.entries(groupBy(txs, "user_id"));
  // For each user
  // Grab first tx
  // Send to proper type queue
  // Dispatch all handlers
  const txsToProcess: Record<string, MachineTransaction[]> = {};
  byUser.map(async (entry) => {
    const [user, userTxs] = entry;
    const [tx] = userTxs;
    // First transaction
    if (!tx || !tx.state) {
      functions.logger.error(`Transaction without state?`, { tx, user });
      return;
    }
    // if tx aborted, abort all next?
    if (tx.state.matches("aborted")) {
      functions.logger.warn(`Something went wrong. Need to manually retry`, {
        tx,
      });
      return;
    }
    // Push all txs with the same initial state. Process batches
    const stateValue = tx.state.value as string;
    for (const currentTx of userTxs) {
      if (!txsToProcess[stateValue]) txsToProcess[stateValue] = [];
      if (currentTx.state?.matches(stateValue))
        txsToProcess[stateValue].push(currentTx);
      else return;
    }
  });
  const { pending = [], processing = [], failed = [] } = txsToProcess;
  const promises = [] as Array<Promise<any>>;
  if (pending.length > 0) promises.push(processPending(pending));
  if (processing.length > 0) promises.push(processProcessing(processing));
  if (failed.length > 0) promises.push(processFailed(failed));
  await Promise.all(promises);
}
