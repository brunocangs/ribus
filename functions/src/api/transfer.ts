import { ethers } from "ethers";
import { Router } from "express";
import { verify } from "jsonwebtoken";
import { abi as TokenAbi } from "../../../solidity/artifacts/src/contracts/RibusToken.sol/RibusToken.json";
import { abi as ForwarderAbi } from "../../../solidity/artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import d from "../../../solidity/deploy.json";
import { signMetaTxRequest } from "../../../solidity/src/lib/signer_node";
import { chainIdToName } from "../../../solidity/src/lib/utils";
import {
  MinimalForwarderUpgradeable,
  RibusToken,
} from "../../../solidity/typechain";
import { getChildWallet, getProvider, getSigner } from "../utils";
import { RibusTransferJWT } from "./../../../solidity/src/types/index";

export const transferRouter = Router();

const deploy = d as any;
const FAIL = {
  success: false,
  hash: null,
};

async function handler(body: Record<string, any>) {
  // Parse webhook payload
  if (!body) throw new Error(`Missing payload`);
  const { from, jwt } = body;
  if (!from || !jwt) throw new Error(`Invalid payload`);
  let jwtPayload: RibusTransferJWT;
  jwtPayload = verify(jwt, "secret", {
    issuer: "app.ribus.com.br",
  }) as RibusTransferJWT;
  if (
    !jwtPayload.amount ||
    !jwtPayload.wallet ||
    !jwtPayload.user_id ||
    !jwtPayload.jti
  )
    throw new Error("Invalid payload");

  const provider = getProvider();
  const signer = getSigner();
  console.log(await signer.getAddress());
  const network = await provider._networkPromise;
  const tokenContract = new ethers.Contract(
    deploy[chainIdToName[network.chainId]].token,
    TokenAbi
  ).connect(signer) as unknown as RibusToken;
  const forwarder = new ethers.Contract(
    deploy[chainIdToName[network.chainId]].forwarder,
    ForwarderAbi,
    signer
  ) as unknown as MinimalForwarderUpgradeable;
  const child = await getChildWallet(jwtPayload.user_id.toString());
  // first tx
  //   if (from) {
  let tx = await tokenContract.transferFrom(
    from,
    child.address,
    jwtPayload.amount
  );
  // return { hash: tx.hash };
  //   }
  const firstTx = await provider.getTransaction(tx.hash);
  await firstTx.wait();
  // second tx

  const { request, signature } = await signMetaTxRequest(
    child.privateKey,
    forwarder,
    {
      data: tokenContract.interface.encodeFunctionData("transfer", [
        jwtPayload.wallet,
        jwtPayload.amount,
      ]),
      from: child.address,
      to: tokenContract.address,
    }
  );
  const secondTx = await forwarder.execute(request, signature);
  return { firstTx: firstTx.hash, secondTx: secondTx.hash };
}

/**
 * req.body: {
 *  from: address,
 *  jwt: string
 * }
 */
transferRouter.post("/", async (req, res) => {
  try {
    const result = await handler(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});
