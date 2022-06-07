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
import { signMetaTxRequest } from "../lib/signer_node";
import { chainIdToName } from "../lib/utils";
import { abi as ForwarderAbi } from "../../artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import { abi as TokenAbi } from "../../artifacts/src/contracts/RibusToken.sol/RibusToken.json";
import { verify } from "jsonwebtoken";
import { RibusTransferJWT } from "../types";
const deploy = d as any;
const FAIL = {
  success: false,
  hash: null,
};
async function handler(
  event: AutotaskEvent & RelayerParams & { isLocal?: true }
) {
  // Parse webhook payload
  const seed = event.secrets?.seed || "";
  if (!event.request || !event.request.body) throw new Error(`Missing payload`);
  const { data, index, jwt } = event.request.body as Record<string, any>;
  if (!data || !jwt) throw new Error(`Invalid payload`);
  let jwtPayload: RibusTransferJWT;
  try {
    jwtPayload = verify(jwt, "secret") as RibusTransferJWT;
    if (data.amount > jwtPayload.amount) throw new Error("Invalid amount");
  } catch (err) {
    return {
      ...FAIL,
      error: err,
    };
  }
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
  const parent = HDNode.fromSeed(seed);

  const key = parent.derivePath(
    defaultPath.replace(/\d$/, jwtPayload.user_id.toString())
  ).privateKey;
  if (data.from) {
    const child = new ethers.Wallet(key, provider);
    if (child.address !== data.to) {
      return {
        ...FAIL,
        error: {
          message: "Bad to/user_id pair",
        },
      };
    }
    let tx = await tokenContract.transferFrom(data.from, data.to, data.amount);
    return { hash: tx.hash };
  } else {
    if (index !== jwtPayload.user_id) {
      return {
        ...FAIL,
        error: {
          message: "Bad index/user_id pair",
          details: { index, user_id: jwtPayload.user_id },
        },
      };
    }
    const child = new ethers.Wallet(key, provider);

    if (!index) throw new Error("Invalid payload");
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
          // from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          to: "0x86F29c36887514Fe7106294D909e378442f06050",
          amount: 4567,
        },
        index: 1,
        jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ3YWxsZXQiOiIweDExM0RCNTc3M2Y4YTk2RTVjRmM1Njg1MGExNDAzNWIwRUEyMDU3NGUiLCJhbW91bnQiOjQ1NjcsImlhdCI6MTY1NDYzODU1MSwiZXhwIjoxNjU0NjQ1NzUxLCJpc3MiOiJhcHAucmlidXMuY29tLmJyIn0.IgktAJK4PvxICd2Y2C337D4fXm03BmLZEbVyBB4Zu74",
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
