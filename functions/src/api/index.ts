import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import { relayRouter } from "./relay";
import { walletRouter } from "./wallet";

const app = express();
app.use(cors({ origin: true }));

app.use("/wallet", walletRouter);
app.use("/relay", relayRouter);

export const api = functions
  .runWith({ secrets: ["SEED"], minInstances: 1 })
  .https.onRequest(app);
