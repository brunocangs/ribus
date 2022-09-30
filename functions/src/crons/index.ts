import { logger, runWith } from "firebase-functions";
import groupBy from "lodash.groupby";
import { getTxsByUser, MachineTransaction } from "../utils";
import {
  processFailed,
  processPending,
  processProcessing,
} from "./../machines/handlers";

const secrets = ["SEED", "JWT_SECRET"];

export const progressStates = runWith({
  secrets,
})
  .pubsub.schedule("every minute")
  .onRun(async () => {
    console.log(`Called CRON`);
    const txs = await getTxsByUser();
    const byUser = Object.entries(groupBy(txs, "user_id"));
    // For each user
    // Grab first tx
    // Send to proper type queue
    // Dispatch all handlers
    const txsToProcess: Record<string, MachineTransaction[]> = {};
    byUser.map(async (entry) => {
      const [, [tx]] = entry;
      // First transaction
      if (!tx || !tx.state) {
        logger.warn(`Transaction without state?`, { tx });
        return;
      }
      const stateValue = tx.state.value as string;
      // if tx aborted, abort all next?
      if (tx.state.matches("aborted")) {
        logger.warn(`Something went wrong. Need to manually retry`, {
          tx,
        });
        return;
      }
      if (!txsToProcess[stateValue]) txsToProcess[stateValue] = [];
      txsToProcess[stateValue].push(tx);
    });
    const { pending = [], processing = [], failed = [] } = txsToProcess;
    const promises = [] as Array<Promise<any>>;
    if (pending.length > 0) promises.push(processPending(pending));
    if (processing.length > 0) promises.push(processProcessing(processing));
    if (failed.length > 0) promises.push(processFailed(failed));
    await Promise.all(promises);
    return null;
  });
