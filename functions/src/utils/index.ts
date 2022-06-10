import axios from "axios";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "defender-relay-client/lib/ethers";
import { ethers } from "ethers";
import { defaultPath, HDNode } from "ethers/lib/utils";
import { getFunctions } from "firebase-admin/functions";
import { hardhatWallet } from "../../../solidity/src/lib/utils";

const isLocal = process.env.NODE_ENV === "development";

export const getSeed = () => {
  const seed = process.env.SEED;
  if (!seed) throw new Error(`Missing secrets`);
  return seed;
};

export const taskQueue = (taskName: string) => {
  const {
    FUNCTION_EMULATOR_HOST = "http://localhost:5001",
    PROJECT_ID = "ribus-demo",
    REGION = "us-central1",
  } = process.env;
  if (process.env.NODE_ENV === "development") {
    return async (data: Record<string, any>, opts?: any) => {
      const url = `http://${FUNCTION_EMULATOR_HOST}/${PROJECT_ID}/${REGION}/${taskName}`;
      try {
        await axios.post(url, JSON.stringify({ data }), {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer blep",
          },
        });
      } catch (err) {
        console.error(err);
      }
    };
  } else {
    const queue = getFunctions().taskQueue("testQueue");
    return queue.enqueue;
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
