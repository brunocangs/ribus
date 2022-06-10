import { AutotaskEvent } from "defender-autotask-utils";
import { RelayerParams } from "defender-relay-client";
import { ethers } from "ethers";
import { Router } from "express";
// Entrypoint for the Autotask
import { abi as ForwarderAbi } from "../../../solidity/artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import d from "../../../solidity/deploy.json";
import { chainIdToName } from "../../../solidity/src/lib/utils";
import { UpgradeableForwarder } from "../../../solidity/typechain";
import { getProvider, getSigner } from "../utils";

export const relayRouter = Router();

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

async function handler(body: Record<string, any>) {
  // Parse webhook payload
  const { request, signature } = body;
  if (!request || !signature) throw new Error("Invalid Payload");

  // Initialize Relayer provider and signer, and forwarder contract
  const provider = getProvider();
  const signer = getSigner();
  const network = await provider._networkPromise;
  const ForwarderAddress = deploy[chainIdToName[network.chainId]].forwarder;
  const forwarder = new ethers.BaseContract(
    ForwarderAddress,
    ForwarderAbi,
    signer
  ) as unknown as UpgradeableForwarder;

  // Relay transaction!
  const tx = await relay(forwarder, request, signature);
  return { hash: tx.hash };
}

relayRouter.post("/", async (req, res) => {
  try {
    const result = await handler(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});
