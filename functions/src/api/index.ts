import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import { v1Router } from "./v1";
import { v2Router } from "./v2";

const app = express();
app.use(cors({ origin: true }));

app.use("/v1", v1Router);
app.use("/v2", v2Router);
app.use(v1Router);

const secrets = ["SEED", "JWT_SECRET"];

export const api = functions.runWith({ secrets }).https.onRequest(app);
