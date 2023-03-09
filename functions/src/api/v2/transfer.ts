import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { verify } from "jsonwebtoken";
import { RibusTransferJWT } from "../../../../solidity/src/types/index";
import { txMachine } from "../../machines/transaction.machine";
import { getChildWallet, getContracts, getTx, saveTx } from "../../utils";

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
  const { iat, exp, iss, jti, ...jwtData } = jwtPayload;
  const failedResponse = {
    success: false,
    id: null,
  };
  logger.debug(`Received JWT`, jwtPayload, jwt);
  try {
    const request = await getTx(jti);
    if (request && !request.state?.matches("aborted")) {
      logger.warn(`Repeated attempt to claim`, jwtPayload);
      return failedResponse;
    }
    // Pull data from JWT
    // Who is sending => Internal or external
    let sender: string;
    if (jwtData.from_user_id !== undefined) {
      sender = await getChildWallet(
        jwtData.from_user_id.toString()
      ).getAddress();
    } else if (jwtData.from_wallet !== undefined) {
      sender = jwtData.from_wallet;
    } else throw new Error("Missing sender information");

    // Who is receiving => Internal or external
    let receiver: string;
    if (jwtData.to_user_id !== undefined) {
      receiver = await getChildWallet(
        jwtData.to_user_id.toString()
      ).getAddress();
    } else if (jwtData.to_wallet !== undefined) {
      receiver = jwtData.to_wallet;
    } else throw new Error("Missing receiver information");

    const isInternal = jwtData.from_user_id !== undefined;
    // If there's from_user_id, tx `from` and signer must be child wallet
    const user_id = isInternal ? jwtData.from_user_id?.toString() ?? "0" : "0";

    const { token } = await getContracts();

    let data: string;
    if (isInternal) {
      // Validate tx. Will throw on fail
      await token
        .connect(getChildWallet(user_id))
        .callStatic.transfer(receiver, jwtData.amount);
      // If there's from_user_id, tx data will be transfer from self
      data = token.interface.encodeFunctionData("transfer", [
        receiver,
        jwtData.amount,
      ]);
    } else {
      // Validate tx. Will throw on fail
      await token
        .connect(getChildWallet(user_id))
        .callStatic.transferFrom(sender, receiver, jwtData.amount);
      // If there's from_wallet, tx will be transferFrom as third party
      data = token.interface.encodeFunctionData("transferFrom", [
        sender,
        receiver,
        jwtData.amount,
      ]);
    }
    await saveTx(jti, {
      user_id,
      to: token.address,
      data,
      jwt: jwtData,
      state: txMachine.initialState,
      sentAt: Timestamp.fromDate(new Date()),
    });
  } catch (err: any) {
    let errorMsg: string;
    try {
      errorMsg = JSON.parse(err.error.body).error.message;
    } catch {
      errorMsg = err.toString();
    }
    // logger.error(err);
    await saveTx(jti, {
      jwt: jwtData,
      sentAt: Timestamp.fromDate(new Date()),
      state: txMachine.transition(txMachine.initialState, {
        type: "abort",
        error: errorMsg,
      }),
    });
    return {
      ...failedResponse,
      error: errorMsg,
    };
  }
  return {
    success: true,
    id: jti,
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
