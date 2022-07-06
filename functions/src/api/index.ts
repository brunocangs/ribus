import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import { anyRouter } from "./any";
import { relayRouter } from "./relay";
import { claimRouter } from "./claim";
import { tokenRouter } from "./token";
import { transferRouter } from "./transfer";
import { walletRouter } from "./wallet";

const app = express();
app.use(cors({ origin: true }));

app.use("/wallet", walletRouter);
app.use("/relay", relayRouter);
app.use("/transfer", transferRouter);
app.use("/token", tokenRouter);
app.use("/claim", claimRouter);

if (process.env.NODE_ENV === "development") app.use(anyRouter);

const secrets = ["SEED", "JWT_SECRET"];

export const api = functions.runWith({ secrets }).https.onRequest(app);
