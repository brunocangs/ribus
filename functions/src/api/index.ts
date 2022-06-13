import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import { relayRouter } from "./relay";
import { transferRouter } from "./transfer";
import { walletRouter } from "./wallet";

const app = express();
app.use(cors({ origin: true }));

app.use("/wallet", walletRouter);
app.use("/relay", relayRouter);
app.use("/transfer", transferRouter);

export const api = functions
  .runWith({ secrets: ["SEED"] })
  .https.onRequest(app);
