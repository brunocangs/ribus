import { AutotaskEvent } from "defender-autotask-utils";
import { RelayerParams } from "defender-relay-client";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "defender-relay-client/lib/ethers";
import { ethers } from "ethers";
import { defaultPath, HDNode } from "ethers/lib/utils";
import d from "../../deploy.json";
import { MinimalForwarderUpgradeable, RibusToken } from "../../typechain";
import { signMetaTxRequest } from "../lib/signer";
import { chainIdToName } from "../lib/utils";
import { abi as ForwarderAbi } from "../../artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import { abi as TokenAbi } from "../../artifacts/src/contracts/RibusToken.sol/RibusToken.json";

const deploy = d as any;

async function handler(
  event: AutotaskEvent & RelayerParams & { isLocal?: true }
) {
  // Parse webhook payload
  const seed = event.secrets?.seed || "";
  if (!event.request || !event.request.body) throw new Error(`Missing payload`);
  const { data, index } = event.request.body as Record<string, any>;
  if (!data) throw new Error(`Invalid payload`);

  const credentials = { ...event };
  const provider = event.isLocal
    ? new ethers.providers.JsonRpcProvider()
    : new DefenderRelayProvider(credentials);
  const signer = event.isLocal
    ? await (async () => {
        const { ethers } = await import("hardhat");
        return (await ethers.getSigners())[0];
      })()
    : new DefenderRelaySigner(credentials, provider, {
        speed: "fast",
      });

  const network = await provider._networkPromise;
  const tokenContract = new ethers.Contract(
    deploy[chainIdToName[network.chainId]].token,
    TokenAbi
  ).connect(signer) as RibusToken;
  const forwarder = new ethers.Contract(
    deploy[chainIdToName[network.chainId]].forwarder,
    ForwarderAbi,
    signer
  ) as MinimalForwarderUpgradeable;
  if (data.from) {
    let tx = await tokenContract.transferFrom(data.from, data.to, data.amount);
    return tx;
  } else {
    if (!index) throw new Error("Invalid payload");
    const parent = HDNode.fromSeed(seed);
    const key = parent.derivePath(defaultPath.replace(/\d$/, index)).privateKey;
    const child = new ethers.Wallet(key, provider);
    const { request, signature } = await signMetaTxRequest(key, forwarder, {
      data: tokenContract.interface.encodeFunctionData("transfer", [
        data.to,
        data.amount,
      ]),
      from: child.address,
      to: tokenContract.address,
    });
    const tx = await forwarder.execute(request, signature);
    return { hash: tx.hash };
  }
}

module.exports = {
  handler,
};
// Sample typescript type definitions
type EnvInfo = {
  DEFENDER_API_KEY: string;
  DEFENDER_API_SECRET: string;
  SEED: string;
};

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require("dotenv").config();
  const {
    DEFENDER_API_KEY: apiKey,
    DEFENDER_API_SECRET: apiSecret,
    SEED: seed,
  } = process.env as EnvInfo;

  handler({
    apiKey,
    apiSecret,
    secrets: {
      seed,
    },
    request: {
      body: {
        data: {
          to: "0x3eb0f5D0802EDD470c874880f70EbE5077c071E0",
          amount: 100,
        },
        index: 1,
      },
    },
    // isLocal: true,
  })
    .then((res) => {
      console.log(res);
      process.exit(0);
    })
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });
}
