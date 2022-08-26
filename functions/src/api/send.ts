import { logger } from "firebase-functions";
import { Router } from "express";
import { verify } from "jsonwebtoken";
import { app, signToken, taskQueue } from "../utils";
import { RibusSendJWT } from "./../../../solidity/src/types/index";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

export const sendRouter = Router();

async function handler(body: Record<string, any>) {
  // Parse webhook payload
  if (!body) throw new Error(`Missing payload`);
  const { jwt } = body;
  if (!jwt) throw new Error(`Invalid payload`);
  let jwtPayload: RibusSendJWT;
  jwtPayload = verify(jwt, process.env.JWT_SECRET as string, {
    issuer: "app.ribus.com.br",
  }) as RibusSendJWT;
  if (
    !jwtPayload.amount ||
    !jwtPayload.user_id_from ||
    // Either internal or external tx
    !(jwtPayload.user_id_to || jwtPayload.wallet) ||
    !jwtPayload.jti
  )
    throw new Error("Invalid payload");
  const firestore = getFirestore(app);
  const requestRef = firestore.collection("send_requests").doc(jwtPayload.jti);
  const failedResponse = {
    success: false,
    id: null,
  };
  try {
    const request = await requestRef.get();
    const itemData = request.data();
    if (request && request.exists && itemData && itemData.status !== "ERROR") {
      logger.warn(`Repeated attempt to send`, jwtPayload);
      return failedResponse;
    }
    const enqueue = taskQueue("sendFunds");
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
        error: err.message,
      },
      { merge: true }
    );
    return { ...failedResponse, error: err.message };
  }
  return {
    success: true,
    id: jwtPayload.jti,
  };
}

sendRouter.post("/", async (req, res) => {
  try {
    const result = await handler(req.body);
    res.json(result);
  } catch (err: any) {
    logger.error(err);
    res.status(500).send(err.message);
  }
});

sendRouter.get("/:requestId", async (req, res) => {
  const { requestId } = req.params;
  if (!requestId) {
    return res.status(500).send(`Invalid`);
  }
  const firestore = getFirestore();
  const requestsCollection = firestore.collection("send_requests");
  const requestSnapshot = await requestsCollection.doc(requestId).get();
  if (requestSnapshot && requestSnapshot.exists) {
    return res.json({
      token: signToken(requestSnapshot.data(), requestSnapshot.id),
    });
  } else {
    return res.status(404).send(`Not Found`);
  }
});
