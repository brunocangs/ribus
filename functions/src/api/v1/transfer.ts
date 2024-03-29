import { logger } from "firebase-functions";
import { Router } from "express";
import { verify } from "jsonwebtoken";
import { app, taskQueue } from "../../utils";
import { RibusTransferJWTV1 } from "../../../../solidity/src/types/index";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

export const transferRouter = Router();

async function handler(body: Record<string, any>) {
  // Parse webhook payload
  if (!body) throw new Error(`Missing payload`);
  const { from = "0xe3574A9FBb027bcc61c706f93AB5beC22c7EECa0", jwt } = body;
  if (!from || !jwt) throw new Error(`Invalid payload`);
  let jwtPayload: RibusTransferJWTV1;
  jwtPayload = verify(jwt, process.env.JWT_SECRET as string, {
    issuer: "app.ribus.com.br",
  }) as RibusTransferJWTV1;
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
