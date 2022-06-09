import { chainIdToName, hardhatWallet } from "./../../solidity/src/lib/utils";
import * as functions from "firebase-functions";

import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "defender-relay-client/lib/ethers";
import * as ethers from "ethers";
import { defaultPath, HDNode } from "ethers/lib/utils";
// Entrypoint for the Autotask
import { abi as ForwarderAbi } from "../../solidity/artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import * as d from "../../solidity/deploy.json";
import { signMetaTxRequest } from "../../solidity/src/lib/signer_node";
const deploy = d as any;

async function handler(body: Record<string, any>) {
  // Parse webhook payload
  const credentials = {
    apiKey: process.env.DEFENDER_API_KEY as string,
    apiSecret: process.env.DEFENDER_API_SECRET as string,
  };
  const isLocal = process.env.NODE_ENV === "development";
  const seed = process.env.SEED;
  if (!body) throw new Error(`Missing payload`);
  if (!seed) throw new Error(`Missing secrets`);
  const { index, data } = body;
  if (!index) throw new Error(`Missing payload`);
  const parent = HDNode.fromSeed(seed);
  const key = parent.derivePath(defaultPath.replace(/\d$/, index)).privateKey;
  const provider = !isLocal
    ? new DefenderRelayProvider(credentials)
    : new ethers.providers.JsonRpcProvider();
  const child = new ethers.Wallet(key, provider);
  const signer = isLocal
    ? hardhatWallet.connect(provider)
    : new DefenderRelaySigner(credentials, provider, {
        speed: "fast",
      });
  if (data) {
    const network = await provider._networkPromise;

    const ForwarderAddress = deploy[chainIdToName[network.chainId]].forwarder;
    const forwarder = new ethers.Contract(
      ForwarderAddress,
      ForwarderAbi,
      signer
    ) as any;

    const { request, signature } = await signMetaTxRequest(key, forwarder, {
      ...data,
      from: child.address,
    });
    const tx = await forwarder.execute(request, signature);
    return {
      ...tx,
      address: child.address,
    };
  } else {
    return { address: child.address };
  }
}

export const helloWorld = functions
  .runWith({ secrets: ["SEED", "SEED_PASS"] })
  .https.onRequest(async (request, response) => {
    if (request.method === "GET") {
      response.status(404).end();
      return;
    }
    const result = await handler(request.body);
    response.send(result);
  });
