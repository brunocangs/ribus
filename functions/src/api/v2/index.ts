import cors from "cors";
import express from "express";
import { getProvider, getSigner, getUserTxs } from "../../utils";
import { anyRouter } from "./any";
import { claimRouter } from "./claim";
import { processTxs } from "../../utils/processTxs";
import { tokenRouter } from "./token";
import { transferRouter } from "./transfer";
import { walletRouter } from "./wallet";

const app = express();

app.use("/transfer", transferRouter);
app.use("/claim", claimRouter);
app.use("/wallet", walletRouter);
app.get("/", async (_, res) =>
  res.json({
    address: await getSigner().getAddress(),
    network: await getProvider().getNetwork(),
    version: 2,
  })
);

if (process.env.NODE_ENV !== "production") {
  app.get("/process", async (_, res) => {
    res.json({
      ok: true,
    });
    await processTxs();
  });

  app.use("/token", tokenRouter);
  app.use(anyRouter);
}

export const v2Router = app;
