import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import { getSigner } from "../utils";
import { anyRouter } from "./any";
import { claimRouter } from "./claim";
import { tokenRouter } from "./token";
import { transferRouter } from "./transfer";

const app = express();
app.use(cors({ origin: true }));

app.use("/transfer", transferRouter);
app.use("/claim", claimRouter);

if (process.env.NODE_ENV !== "production") {
  app.get("/", async (_, res) =>
    res.json({ address: await getSigner().getAddress() })
  );
  app.use("/token", tokenRouter);
  app.use(anyRouter);
}

const secrets = ["SEED", "JWT_SECRET"];

export const api = functions.runWith({ secrets }).https.onRequest(app);
