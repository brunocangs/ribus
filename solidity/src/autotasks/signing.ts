import { AutotaskEvent } from "defender-autotask-utils";
import { RelayerParams } from "defender-relay-client";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "defender-relay-client/lib/ethers";
import { ethers } from "ethers";
import { defaultPath, HDNode } from "ethers/lib/utils";
// Entrypoint for the Autotask
import { abi as ForwarderAbi } from "../../artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import d from "../../deploy.json";
import { UpgradeableForwarder } from "../../typechain";
import { signMetaTxRequest } from "../lib/signer";
import { chainIdToName } from "../lib/utils";

const deploy = d as any;

async function handler(
  event: AutotaskEvent & RelayerParams & { isLocal?: true }
) {
  // Parse webhook payload
  const seed = event.secrets?.seed;
  if (!event.request || !event.request.body) throw new Error(`Missing payload`);
  if (!seed) throw new Error(`Missing Secrets`);
  const { index, data } = event.request.body as Record<string, any>;
  if (!index) throw new Error(`Missing payload`);

  const parent = HDNode.fromSeed(seed);
  const key = parent.derivePath(defaultPath.replace(/\d$/, index)).privateKey;
  const child = new ethers.Wallet(key);

  const credentials = { ...event };
  const provider = !event.isLocal
    ? new DefenderRelayProvider(credentials)
    : new ethers.providers.JsonRpcProvider();
  const signer = new DefenderRelaySigner(credentials, provider, {
    speed: "fast",
  });
  if (data) {
    const network = await provider._networkPromise;

    const ForwarderAddress = deploy[chainIdToName[network.chainId]].forwarder;
    const forwarder = new ethers.Contract(
      ForwarderAddress,
      ForwarderAbi,
      signer
    ) as UpgradeableForwarder;

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
  const ribusInterface = new ethers.utils.Interface([
    "function transfer(address to, uint256 amount) public returns (bool)",
  ]);
  handler({
    apiKey,
    apiSecret,
    secrets: {
      seed,
    },
    request: {
      body: {
        index: 2,
        // data: {
        //   to: deploy.localhost.token,
        //   data: ribusInterface.encodeFunctionData("transfer", [
        //     "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199",
        //     10000,
        //   ]),
        // },
      },
    },
    isLocal: true,
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
