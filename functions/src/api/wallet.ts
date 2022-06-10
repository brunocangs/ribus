import * as ethers from "ethers";
import express from "express";
// Entrypoint for the Autotask
import { abi as ForwarderAbi } from "../../../solidity/artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import * as d from "../../../solidity/deploy.json";
import { signMetaTxRequest } from "../../../solidity/src/lib/signer_node";
import { chainIdToName } from "../../../solidity/src/lib/utils";
import { getChildWallet, getProvider, getSigner } from "../utils";

const walletRouter = express.Router();

const deploy = d as any;

async function handler(body: Record<string, any>) {
  // Parse webhook payload
  if (!body) throw new Error(`Missing payload`);
  const { index, data } = body;
  if (!index) throw new Error(`Missing payload`);
  const provider = getProvider();
  const child = getChildWallet(index);
  const signer = getSigner();
  if (data) {
    const network = await provider._networkPromise;

    const ForwarderAddress = deploy[chainIdToName[network.chainId]].forwarder;
    const forwarder = new ethers.Contract(
      ForwarderAddress,
      ForwarderAbi,
      signer
    ) as any;

    const { request, signature } = await signMetaTxRequest(
      child.privateKey,
      forwarder,
      {
        ...data,
        from: child.address,
      }
    );
    // const tx = await forwarder.execute(request, signature);
    return { request, signature };
  } else {
    return { address: child.address };
  }
}

walletRouter.post("/", async (request, response) => {
  try {
    console.log({ body: request.body });
    const result = await handler(request.body);
    response.send(result);
  } catch (err: any) {
    response.status(500).send(err.message);
  }
});

export { walletRouter };
