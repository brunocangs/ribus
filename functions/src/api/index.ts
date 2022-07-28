import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import {
  processFailed,
  processPending,
  processProcessing,
} from "../machines/handlers";
import { getProvider, getSigner, getTxs, MachineTransaction } from "../utils";
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

app.get("/process", async (_, res) => {
  res.json({
    ok: true,
  });
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
  processPending(pending);
  processProcessing(processing);
  processFailed(failed);
});

if (process.env.NODE_ENV !== "production") {
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
