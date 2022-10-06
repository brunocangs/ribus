import express from "express";
import { routerV2 } from "./v2";
import * as functions from "firebase-functions";

const app = express();
app.use("/v2", routerV2);

const secrets = ["SEED", "JWT_SECRET"];

export const api = functions.runWith({ secrets }).https.onRequest(app);
