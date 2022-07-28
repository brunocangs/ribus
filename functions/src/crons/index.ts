import {
  processFailed,
  processPending,
  processProcessing,
} from "./../machines/handlers";
import { pubsub, runWith } from "firebase-functions";
import { getTxs, MachineTransaction } from "../utils";

const secrets = ["SEED", "JWT_SECRET"];

export const progressStates = runWith({
  secrets,
})
  .pubsub.schedule("every minute")
  .onRun(async () => {
    const txs = await getTxs();
    const {
      pending = [],
      processing = [],
      failed = [],
    } = txs.reduce((prev, curr) => {
      if (!curr?.state) return prev;
      const val = curr.state.value as string;
      if (!prev[val]) prev[val] = [];
      prev[val] = prev[val].concat({
        ...curr,
      });
      return prev;
    }, {} as Record<string, MachineTransaction[]>);
    const promises = [] as Array<Promise<any>>;
    if (pending.length > 0) promises.push(processPending(pending));
    if (processing.length > 0) promises.push(processProcessing(processing));
    if (failed.length > 0) promises.push(processFailed(failed));
    await Promise.all(promises);
    return null;
  });
