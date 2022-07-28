import ethers from "ethers";
import { MinimalForwarderUpgradeable } from "../../typechain";
type AsyncReturn<T> = T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => any
  ? ReturnType<T>
  : T;

type TxInput = {
  to: string;
  from: string;
  data: string;
  nonce?: ethers.BigNumberish;
};

type SignerType =
  | {
      send: ethers.providers.JsonRpcProvider["send"];
    }
  | string;

const EIP712Domain = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

const ForwardRequest = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "gas", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "data", type: "bytes" },
];

function getMetaTxTypeData(chainId: number, verifyingContract: string) {
  return {
    types: {
      EIP712Domain,
      ForwardRequest,
    },
    domain: {
      name: "MinimalForwarder",
      version: "0.0.1",
      chainId,
      verifyingContract,
    },
    primaryType: "ForwardRequest" as const,
  };
}

async function doSign(
  signer: SignerType,
  from: string,
  data: AsyncReturn<typeof buildTypedData>
) {
  if (typeof signer === "string") {
    const { signTypedData, SignTypedDataVersion } = await import(
      "@metamask/eth-sig-util"
    );
    const privateKey = Buffer.from(signer.replace(/^0x/, ""), "hex");
    return signTypedData({
      data,
      privateKey,
      version: SignTypedDataVersion.V4,
    });
  }
  // Otherwise, send the signTypedData RPC call
  // Note that hardhatvm and metamask require different EIP712 input
  const [method, argData] = ["eth_signTypedData_v4", JSON.stringify(data)];
  return await signer.send(method, [from, argData]);
}

async function buildRequest(
  forwarder: MinimalForwarderUpgradeable,
  input: TxInput
) {
  const nonce = await forwarder
    .getNonce(input.from)
    .then((nonce) => nonce.toString());
  return { value: 0, gas: 1e6, nonce, ...input };
}

async function buildTypedData(
  forwarder: MinimalForwarderUpgradeable,
  request: AsyncReturn<typeof buildRequest>
) {
  const chainId = await forwarder.provider.getNetwork().then((n) => n.chainId);
  const typeData = getMetaTxTypeData(chainId, forwarder.address);
  return { ...typeData, message: request };
}

async function signMetaTxRequest(
  signer: SignerType,
  forwarder: MinimalForwarderUpgradeable,
  input: TxInput
) {
  const request = await buildRequest(forwarder, input);
  const toSign = await buildTypedData(forwarder, request);
  const signature = await doSign(signer, input.from, toSign);
  return { signature, request };
}

export { signMetaTxRequest, buildRequest, buildTypedData };
