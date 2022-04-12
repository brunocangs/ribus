import { TransactionRequest } from "@ethersproject/providers";
import { Router } from "express";
import transactions, { Transaction } from "../models/transactions";

const txRouter = Router();

txRouter.get(`/`, async (req, res) => {
  const allTxs = await transactions.findMany();
  res.json(allTxs);
});

txRouter.get(`/:id`, async (req, res) => {
  const dbTx = await transactions.findFirst({
    where: {
      id: +req.params.id,
    },
  });
  if (!dbTx) {
    res.sendStatus(404);
    return;
  }
  res.json(dbTx);
});

txRouter.post(`/`, async (req, res) => {
  const txBody = req.body as Transaction;
  try {
    await transactions.create({
      data: txBody,
    });
    res.json(txBody);
  } catch (e: any) {
    res.status(500).json(e);
  }
});

export default txRouter;
