import { logger } from "firebase-functions";
import { Router } from "express";
import { verify } from "jsonwebtoken";
import { taskQueue } from "../utils";
import { RibusTransferJWT } from "./../../../solidity/src/types/index";
import { getFirestore } from "firebase-admin/firestore";

export const transferRouter = Router();

async function handler(body: Record<string, any>) {
  // Parse webhook payload
  if (!body) throw new Error(`Missing payload`);
  const { from, jwt } = body;
  if (!from || !jwt) throw new Error(`Invalid payload`);
  let jwtPayload: RibusTransferJWT;
  jwtPayload = verify(jwt, "secret", {
    issuer: "app.ribus.com.br",
  }) as RibusTransferJWT;
  if (
    !jwtPayload.amount ||
    !jwtPayload.wallet ||
    !jwtPayload.user_id ||
    !jwtPayload.jti
  )
    throw new Error("Invalid payload");
  const firestore = getFirestore();
  const requestRef = firestore.collection("claim_requests").doc(jwtPayload.jti);
  const failedResponse = {
    success: false,
    id: null,
  };
  try {
    const request = await requestRef.get();
    if (request && request.exists) {
      logger.warn(`Repeated attempt to claim`, jwtPayload);
      return failedResponse;
    }
    const enqueue = taskQueue("firstTransfer");
    await requestRef.set({
      user_id: jwtPayload.user_id,
      status: "starting",
    });
    enqueue({ ...body, jwtPayload });
  } catch (err: any) {
    requestRef.set(
      {
        status: "errored",
        error: err,
      },
      { merge: true }
    );
    return failedResponse;
  }
  // second tx
  // return { firstTx: firstTx.hash, secondTx: secondTx.hash };
  return {
    success: true,
    id: jwtPayload.jti,
  };
}

/**
 * req.body: {
 *  from: address,
 *  jwt: string
 * }
 */
transferRouter.post("/", async (req, res) => {
  try {
    console.log(req.body);
    const result = await handler(req.body);
    res.json(result);
  } catch (err: any) {
    logger.error(err);
    res.status(500).send(err.message);
  }
});
