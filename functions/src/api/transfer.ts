import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { verify } from "jsonwebtoken";
import { txMachine } from "../machines/transaction.machine";
import { app, getContracts, getNonce, getTx, saveTx } from "../utils";
import { RibusTransferJWT } from "./../../../solidity/src/types/index";

export const transferRouter = Router();

async function handler(body: Record<string, any>) {
  // Parse webhook payload
  if (!body) throw new Error(`Missing payload`);
  const { jwt } = body;
  if (!jwt) throw new Error(`Invalid payload`);
  let jwtPayload: RibusTransferJWT;
  jwtPayload = verify(jwt, process.env.JWT_SECRET as string, {
    issuer: "app.ribus.com.br",
  }) as RibusTransferJWT;
  if (
    !jwtPayload.amount ||
    !(
      jwtPayload.from_user_id !== undefined ||
      jwtPayload.from_wallet !== undefined
    ) ||
    !(
      jwtPayload.to_user_id !== undefined || jwtPayload.to_wallet !== undefined
    ) ||
    !jwtPayload.jti
  )
    throw new Error("Invalid payload");
  const { iat, exp, iss, jti, ...data } = jwtPayload;
  const failedResponse = {
    success: false,
    id: null,
  };
  try {
    const request = await getTx(jti);
    if (request && !request.state?.matches("aborted")) {
      logger.warn(`Repeated attempt to claim`, jwtPayload);
      return failedResponse;
    }
    const { token } = await getContracts();
    await saveTx(jti, {
      // Must be 0 to execute as root wallet
      user_id: "0", // data.user_id.toString(), //
      to: token.address,
      data: token.interface.encodeFunctionData("transferFrom", [
        from,
        data.wallet,
        data.amount,
      ]),
      jwt: data,
      version: 2,
      state: txMachine.initialState,
    });
  } catch (err: any) {
    logger.error(err);
    await saveTx(jti, {
      status: "ERROR",
      message: `Falha ao dar claim em RIB: ${err.message}`,
      error: JSON.stringify(err),
    });
    return failedResponse;
  }
  ("");
  return {
    success: true,
    id: jwtPayload.jti,
  };
}

transferRouter.post("/", async (req, res) => {
  try {
    const result = await handler(req.body);
    res.json(result);
  } catch (err: any) {
    logger.error(err);
    res.status(500).json({ err });
  }
});
