import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import groupBy from "lodash.groupby";
import {
  processFailed,
  processPending,
  processProcessing,
} from "../../machines/handlers";
import {
  getProvider,
  getSigner,
  getTxsByUser,
  getUserTxs,
  MachineTransaction,
} from "../../utils";
import { anyRouter } from "./any";
import { claimRouter } from "./claim";
import { tokenRouter } from "./token";
import { transferRouter } from "./transfer";
import { walletRouter } from "./wallet";

const app = express();
app.use(cors({ origin: true }));

app.use("/transfer", transferRouter);
app.use("/claim", claimRouter);
app.use("/wallet", walletRouter);

if (process.env.NODE_ENV !== "production") {
  app.get("/process", async (_, res) => {
    res.json({
      ok: true,
    });
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
        functions.logger.warn(`Transaction without state?`, { tx });
        return;
      }
      const stateValue = tx.state.value as string;
      // if tx aborted, abort all next?
      if (tx.state.matches("aborted")) {
        functions.logger.warn(`Something went wrong. Need to manually retry`, {
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
  });

  app.get("/test/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      res.json(await getUserTxs(+userId));
    } catch (err) {
      res.json({ err });
    }
  });
  app.get("/", async (_, res) =>
    res.json({
      address: await getSigner().getAddress(),
      network: await getProvider().getNetwork(),
    })
  );
  app.use("/token", tokenRouter);
  app.use(anyRouter);
}

export const routerV2 = app;
