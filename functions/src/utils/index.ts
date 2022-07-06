import axios from "axios";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "defender-relay-client/lib/ethers";
import { ethers } from "ethers";
import { defaultPath, HDNode } from "ethers/lib/utils";
import { credential } from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getFunctions, TaskOptions } from "firebase-admin/functions";
import { logger } from "firebase-functions";
import { sign } from "jsonwebtoken";
import { hardhatWallet } from "../../../solidity/src/lib/utils";
import devServiceAccount from "../../service-account.dev.json";
import prodServiceAccount from "../../service-account.prod.json";

const isLocal = process.env.NODE_ENV === "development";

const serviceAccount = isLocal ? devServiceAccount : prodServiceAccount;

const app = initializeApp({
  credential: credential.cert(serviceAccount as any),
});

export const getSeed = () => {
  const seed = process.env.SEED;
  if (!seed) throw new Error(`Missing secrets`);
  return seed;
};

export const postFeedback = async (token: any) => {
  console.log(`postFeedback - Posting to ${process.env.FEEDBACK_SERVER_URL}`, {
    token,
  });
  const [, content] = token.split(".");
  const jwtPayload = JSON.parse(Buffer.from(content, "base64").toString());

  const firestore = getFirestore();
  const requestRef = firestore.collection("claim_requests").doc(jwtPayload.jti);
  try {
    const req = await axios.post(
      process.env.FEEDBACK_SERVER_URL as string,
      JSON.stringify({ token }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    requestRef.set(
      {
        synced: true,
      },
      { merge: true }
    );
    return req;
  } catch (err) {
    requestRef.set(
      {
        synced: false,
      },
      { merge: true }
    );
    logger.error(`Errored sending feedback`, { err });
    return;
  }
};

export const taskQueue = (taskName: string) => {
  const { FUNCTION_EMULATOR_HOST = "localhost:5001", REGION = "us-central1" } =
    process.env;
  if (isLocal) {
    return async (data: Record<string, any>, opts?: any) => {
      const url = `http://${FUNCTION_EMULATOR_HOST}/${serviceAccount.project_id}/${REGION}/${taskName}`;
      await axios.post(url, JSON.stringify({ data }), {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer blep",
        },
      });
    };
  } else {
    return (data: Record<string, any>, opts?: TaskOptions | undefined) => {
      const queue = getFunctions(app).taskQueue(taskName);
      return queue.enqueue(data, opts);
    };
  }
};

export const getRootNode = () => HDNode.fromSeed(getSeed());

export const getChildNode = (index: string) =>
  getRootNode().derivePath(defaultPath.replace(/\d$/, index));

export const getChildWallet = (
  index: string,
  provider: ethers.providers.JsonRpcProvider = getProvider()
) => new ethers.Wallet(getChildNode(index).privateKey, provider);

export const getDefenderCredentials = () => ({
  apiKey: process.env.DEFENDER_API_KEY as string,
  apiSecret: process.env.DEFENDER_API_SECRET as string,
});

export const getProvider = () =>
  isLocal
    ? new ethers.providers.JsonRpcProvider()
    : new DefenderRelayProvider(getDefenderCredentials());

export const getSigner = () =>
  isLocal
    ? hardhatWallet.connect(getProvider())
    : new DefenderRelaySigner(getDefenderCredentials(), getProvider(), {
        speed: "fast",
      });

export const signToken = (data: any, id: string, expire = false) => {
  const opts: any = {
    issuer: "app.ribus.com.br",
    algorithm: "HS256",
    jwtid: id,
  };
  if (expire) opts["expiresIn"] = "2h";
  return sign(data, process.env.JWT_SECRET as string, opts);
};
