import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import {
  processFailed,
  processPending,
  processProcessing,
} from "../machines/handlers";
import {
  getProvider,
  getSigner,
  getTxs,
  getTxsByUser,
  getUserTxs,
  MachineTransaction,
} from "../utils";
import { anyRouter } from "./any";
import { claimRouter } from "./claim";
import { tokenRouter } from "./token";
import { transferRouter } from "./transfer";
import { walletRouter } from "./wallet";
import groupBy from "lodash.groupby";

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
    await Promise.all(
      // For each user
      byUser.map(async (entry) => {
        const [userId, txs] = entry;
        let txsToProcess: MachineTransaction[] = [];
        // For each transaction
        for (const index in txs) {
          const tx = txs[index];
          if (!tx.state) {
            functions.logger.warn(`Transaction without state?`, { tx });
            continue;
          }
          // If first tx
          const isFirst = txsToProcess.length === 0;
          if (isFirst) {
            // if first tx is success, continue
            if (tx.state.matches("success")) {
              continue;
            }
            // if tx aborted, abort all next?
            if (tx.state.matches("aborted")) {
              functions.logger.warn(
                `Something went wrong. Need to manually retry`,
                { tx }
              );
              return;
            }
            // if pending, grab all next pending and process
            // if processing, grab all processing and process
            if (tx.state.matches("pending") || tx.state.matches("processing")) {
              txsToProcess.push(tx);
              continue;
            }
            // if first tx is failed
            //   Retry that tx
            //   Return
            if (tx.state.matches("failed")) {
              processFailed([tx]);
            }
          }
        }
      })
    );
    // const {
    //   pending = [],
    //   processing = [],
    //   failed = [],
    // } = txs.reduce((prev, curr) => {
    //   if (!curr?.state) return prev;
    //   const val = curr.state.value as string;
    //   if (!prev[val]) prev[val] = [];
    //   prev[val] = prev[val].concat({
    //     ...curr,
    //   });
    //   return prev;
    // }, {} as Record<string, MachineTransaction[]>);
    // const promises = [] as Array<Promise<any>>;
    // if (pending.length > 0) promises.push(processPending(pending));
    // if (processing.length > 0) promises.push(processProcessing(processing));
    // if (failed.length > 0) promises.push(processFailed(failed));
    // await Promise.all(promises);
  });

  app.get("/test/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      res.json(await getUserTxs(+userId));
    } catch (err) {
      res.json({ err });
    }
  });

  app.get("/", async (_, res) => {
    const provider = getProvider();
    let network: any;
    try {
      network = await provider.getNetwork();
    } catch (err) {
      network = {
        chainId: 31337,
        name: "localhost",
      };
    }
    return res.json({
      address: await getSigner().getAddress(),
      network,
    });
  });
  app.use("/token", tokenRouter);
  app.use(anyRouter);
}

const secrets = ["SEED", "JWT_SECRET"];

export const api = functions.runWith({ secrets }).https.onRequest(app);
