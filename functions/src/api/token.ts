import { Router } from "express";
import { v4 } from "uuid";
import { signToken } from "../utils";

export const tokenRouter = Router();

tokenRouter.get("/", async (req, res) => {
  let { amount = 1, wallet = "0x1C713C99fB1d02237FC7b0bb3f043867ccD79b87" } =
    req.query;
  amount = +amount * Math.pow(10, 8);
  const max = Math.pow(2, 31) - 1;
  const jwt = await signToken(
    {
      user_id: Math.round(Math.random() * 2 + 2),
      wallet,
      amount,
    },
    v4(),
    true
  );
  res.json({ jwt });
});
