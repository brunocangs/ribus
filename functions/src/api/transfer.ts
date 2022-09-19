import { logger } from "firebase-functions";
import { Router } from "express";
import { verify } from "jsonwebtoken";
import { app, taskQueue } from "../utils";
import { RibusTransferJWT } from "./../../../solidity/src/types/index";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

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
  const firestore = getFirestore(app);
  const requestRef = firestore.collection("claim_requests").doc(jwtPayload.jti);
  const failedResponse = {
    success: false,
    id: null,
  };
  try {
    const request = await requestRef.get();
    const itemData = request.data();
    if (request && request.exists && itemData && itemData.status !== "ERROR") {
      logger.warn(`Repeated attempt to claim`, jwtPayload);
      return failedResponse;
    }
    const enqueue = taskQueue("firstTransfer");
    const { iat, exp, iss, jti, ...data } = jwtPayload;
    await requestRef.set({
      ...data,
      status: "STARTING",
      created_at: Timestamp.fromDate(new Date()),
    });
    await enqueue({ ...body, jwtPayload });
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
