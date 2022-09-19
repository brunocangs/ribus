import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import { getProvider, getSigner } from "../utils";
import { anyRouter } from "./any";
import { claimRouter } from "./claim";
import { sendRouter } from "./send";
import { tokenRouter } from "./token";
import { transferRouter } from "./transfer";
import { walletRouter } from "./wallet";

const app = express();
app.use(cors({ origin: true }));

app.use("/transfer", transferRouter);
app.use("/send", sendRouter);
app.use("/claim", claimRouter);
app.use("/wallet", walletRouter);

if (process.env.NODE_ENV !== "production") {
  app.get("/", async (_, res) =>
    res.json({
      address: await getSigner().getAddress(),
      network: await getProvider().getNetwork(),
    })
  );
  app.use("/token", tokenRouter);
  app.use(anyRouter);
}

const secrets = ["SEED", "JWT_SECRET"];

export const api = functions.runWith({ secrets }).https.onRequest(app);
