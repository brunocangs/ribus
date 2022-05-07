import { AutotaskEvent } from "defender-autotask-utils";
import { RelayerParams } from "defender-relay-client";
import { DefenderRelayProvider } from "defender-relay-client/lib/ethers";
import { ethers } from "ethers";
import { defaultPath, HDNode } from "ethers/lib/utils";
// Entrypoint for the Autotask
import { abi as ForwarderAbi } from "../../artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import d from "../../deploy.json";
import { UpgradeableForwarder } from "../../typechain";
import { signMetaTxRequest } from "../lib/signer";
import { chainIdToName } from "../lib/utils";

const deploy = d as any;
const wallet = `{"address":"c9437ed573eda427a1a3ef963421b9a8d40224c7","id":"aa8d3d0b-75b0-4311-aee0-bc426beb1735","version":3,"Crypto":{"cipher":"aes-128-ctr","cipherparams":{"iv":"701d66dd77ade024c224c90f12976e37"},"ciphertext":"553d205c58d64063ec37234837d016612b767ae8aafcfb14ad4754b456516474","kdf":"scrypt","kdfparams":{"salt":"207a2a2c1a500081d01eb402bab0db942eb2d43607341ab5e262623a2c421b21","n":131072,"dklen":32,"p":1,"r":8},"mac":"457d97d616875a18a48fe08ca0f2fac1d48a85782acfbcc5bb40b31f077f2b90"},"x-ethers":{"client":"ethers.js","gethFilename":"UTC--2022-05-06T21-26-35.0Z--c9437ed573eda427a1a3ef963421b9a8d40224c7","mnemonicCounter":"ad374d94da6141c33fee3b465fbeb2de","mnemonicCiphertext":"56b502b9095ebf399b28031899e92921","path":"m/44'/60'/0'/0/0","locale":"en","version":"0.1"}}`;

async function handler(
  event: AutotaskEvent & RelayerParams & { isLocal?: true }
) {
  // Parse webhook payload
  const seed = event.secrets?.seed;
  if (!event.request || !event.request.body) throw new Error(`Missing payload`);
  if (!seed) throw new Error(`Missing Secrets`);
  const { index, data } = event.request.body as Record<string, any>;
  if (!index || !data) throw new Error(`Missing payload`);

  const parent = HDNode.fromSeed(seed);
  const credentials = { ...event };
  const provider = !event.isLocal
    ? new DefenderRelayProvider(credentials)
    : new ethers.providers.JsonRpcProvider();

  const network = await provider._networkPromise;

  const ForwarderAddress = deploy[chainIdToName[network.chainId]].forwarder;
  const forwarder = new ethers.Contract(
    ForwarderAddress,
    ForwarderAbi,
    provider
  ) as UpgradeableForwarder;

  const key = parent.derivePath(defaultPath.replace(/\d$/, index)).privateKey;
  const child = new ethers.Wallet(key);

  return await signMetaTxRequest(key, forwarder, {
    ...data,
    from: child.address,
  });
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
        index: 1,
        data: {
          to: deploy.localhost.token,
          data: ribusInterface.encodeFunctionData("transfer", [
            "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199",
            10000,
          ]),
        },
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
