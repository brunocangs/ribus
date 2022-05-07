import { AutotaskEvent } from "defender-autotask-utils";
import { RelayerParams } from "defender-relay-client";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "defender-relay-client/lib/ethers";
import { ethers } from "ethers";
// Entrypoint for the Autotask
import { abi as ForwarderAbi } from "../../artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import d from "../../deploy.json";
import { UpgradeableForwarder } from "../../typechain";
const deploy = d as any;

async function relay(
  forwarder: UpgradeableForwarder,
  request: any,
  signature: string,
  whitelist?: string[]
) {
  // Decide if we want to relay this request based on a whitelist
  const accepts = !whitelist || whitelist.includes(request.to);
  if (!accepts) throw new Error(`Rejected request to ${request.to}`);

  // Validate request on the forwarder contract
  const valid = await forwarder.verify(request, signature);
  if (!valid) throw new Error(`Invalid request`);

  // Send meta-tx through relayer to the forwarder contract
  const gasLimit = (parseInt(request.gas) + 50000).toString();
  return await forwarder.execute(request, signature, { gasLimit });
}

async function handler(event: AutotaskEvent & RelayerParams) {
  // Parse webhook payload
  if (!event.request || !event.request.body) throw new Error(`Missing payload`);
  const { request, signature } = event.request.body as Record<string, any>;
  console.log(`Relaying`, request);

  // Initialize Relayer provider and signer, and forwarder contract
  const credentials = { ...event };
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, {
    speed: "fast",
  });
  const network = provider.network;
  const ForwarderAddress = deploy[network.name].forwarder;
  const forwarder = new ethers.Contract(
    ForwarderAddress,
    ForwarderAbi,
    signer
  ) as UpgradeableForwarder;

  // Relay transaction!
  const tx = await relay(forwarder, request, signature);
  console.log(`Sent meta-tx: ${tx.hash}`);
  return { txHash: tx.hash };
}

module.exports = {
  handler,
  relay,
};
// Sample typescript type definitions
type EnvInfo = {
  DEFENDER_API_KEY: string;
  DEFENDER_API_SECRET: string;
};

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require("dotenv").config();
  const { DEFENDER_API_KEY: apiKey, DEFENDER_API_SECRET: apiSecret } =
    process.env as EnvInfo;
  handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });
}
