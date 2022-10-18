import { Router } from "express";
import { verify } from "jsonwebtoken";
import { v4 } from "uuid";
import { signToken } from "../../utils";

export const tokenRouter = Router();

tokenRouter.get("/", async (req, res) => {
  let {
    amount = 1,
    from_wallet,
    to_wallet,
    from_user_id = 0,
    to_user_id = 1,
  } = req.query;
  amount = +amount * Math.pow(10, 8);
  let senderData = from_wallet ? { from_wallet } : { from_user_id };
  let receiverData = to_wallet ? { to_wallet } : { to_user_id };
  const token = await signToken(
    {
      ...senderData,
      ...receiverData,
      amount,
    },
    v4(),
    true
  );
  res.json({ jwt: token });
});

tokenRouter.post("/decode", (req, res) => {
  const jwt = req?.body?.jwt;
  if (!jwt)
    return res.json({
      success: false,
    });
  return res.json(
    verify(jwt, process.env.JWT_SECRET as string, {
      issuer: "app.ribus.com.br",
    })
  );
});
