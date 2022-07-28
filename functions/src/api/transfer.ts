import { logger } from "firebase-functions";
import { Router } from "express";
import { verify } from "jsonwebtoken";
import { app, createTx, getContracts, saveTx, taskQueue } from "../utils";
import { RibusTransferJWT } from "./../../../solidity/src/types/index";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { txMachine } from "../machines/transaction.machine";

export const transferRouter = Router();

const initialState = txMachine.initialState;

async function handler(body: Record<string, any>) {
  // Parse webhook payload
  if (!body) throw new Error(`Missing payload`);
  const { from = "0xe3574A9FBb027bcc61c706f93AB5beC22c7EECa0", jwt } = body;
  if (!from || !jwt) throw new Error(`Invalid payload`);
  let jwtPayload: RibusTransferJWT;
  jwtPayload = verify(jwt, process.env.JWT_SECRET as string, {
    issuer: "app.ribus.com.br",
  }) as RibusTransferJWT;
  if (
    !jwtPayload.amount ||
    !jwtPayload.wallet ||
    !jwtPayload.user_id ||
    !jwtPayload.jti
  )
    throw new Error("Invalid payload");
  const firestore = getFirestore(app);
  const requestRef = firestore.collection("claim_requests").doc(jwtPayload.jti);
  const failedResponse = {
    success: false,
    id: null,
  };
  try {
    const request = await requestRef.get();
    const itemData = request.data();
    if (request && request.exists) {
      logger.warn(`Repeated attempt to claim`, jwtPayload);
      return failedResponse;
    }
    const { iat, exp, iss, jti, ...data } = jwtPayload;
    const { token } = await getContracts();
    await saveTx(jti, {
      // Must be 0 to execute as root wallet
      user_id: "0",
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
    requestRef.set(
      {
        status: "ERROR",
        message: `Falha ao dar claim em RIB: ${err.message}`,
        error: err,
      },
      { merge: true }
    );
    return failedResponse;
  }
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
    res.status(500).send(err.message);
  }
});
