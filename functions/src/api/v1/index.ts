import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import { getProvider, getSigner } from "../../utils";
import { anyRouter } from "./any";
import { claimRouter } from "./claim";
import { tokenRouter } from "./token";
import { transferRouter } from "./transfer";
import { walletRouter } from "./wallet";

const app = express();

app.use("/transfer", transferRouter);
app.use("/claim", claimRouter);
app.use("/wallet", walletRouter);

app.get("/", async (_, res) =>
  res.json({ address: await getSigner().getAddress(), version: 1 })
);
if (process.env.NODE_ENV !== "production") {
  app.use("/token", tokenRouter);
  app.use(anyRouter);
}

export const v1Router = app;
