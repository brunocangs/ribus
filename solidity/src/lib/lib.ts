import { TransactionRequest } from "@ethersproject/providers";
import axios from "axios";
import * as ethers from "ethers";
import { abi } from "../../artifacts/src/contracts/RibusToken.sol/RibusToken.json";
import { RibusToken } from "../../typechain";
import Network from "./network";
import d from "../../deploy.json";
import { chainIdToName } from "./utils";
const deploy = d as any;
const { task } = Network.shared;

type MakeLibsConfig = {
  contractAddress?: string;
  fundAddress?: string;
  network?: ethers.ethers.providers.Networkish;
};

export default class RibusSdk {
  provider: ethers.providers.JsonRpcProvider;
  RibusContract: RibusToken;
  userIdToAddressMap: Record<string, string> = {};
  fundAddress: string;
  constructor(config: MakeLibsConfig = {}) {
    const { contractAddress, fundAddress, network } = config;
    let tokenAddress =
      contractAddress || deploy[chainIdToName[Network.shared.chainId]].token;
    this.provider = new ethers.providers.JsonRpcProvider(
      Network.shared.RPC_URL,
      network
    );
    this.RibusContract = new ethers.Contract(tokenAddress, abi).connect(
      this.provider
    ) as RibusToken;
    this.fundAddress = fundAddress || ethers.constants.AddressZero;
  }
  signer = (address: string) => new ethers.VoidSigner(address, this.provider);
  signTransaction = async (tx: TransactionRequest, authorization?: string) => {
    try {
      const headers: any = {
        "Content-Type": "application/json; charset=utf-8",
      };
      if (authorization) {
        headers.Authorization = authorization;
      }
      return "";
    } catch (e) {
      return "";
    }
  };
  getTransaction = (txHash: string) => this.provider.getTransaction(txHash);
  send = (signedTx: string | Promise<string>) =>
    this.provider.sendTransaction(signedTx);

  signAndSend = async (tx: TransactionRequest | Promise<TransactionRequest>) =>
    this.signTransaction(await tx).then((signed) => this.send(signed));

  claimRibus = async (
    userId: string | number,
    to: string,
    amount: number
    // certify?: boolean
  ) => {
    if (!this.userIdToAddressMap[userId]) await this.getWalletAddress(userId);
    let userWallet = this.userIdToAddressMap[userId];
    const getTxFor = (prom: Promise<{ result: { hash: string } }>) =>
      prom.then((taskReturn) => {
        console.log(taskReturn);
        const { result } = taskReturn;
        return this.getTransaction(result.hash);
      });
    const firstTx = () =>
      getTxFor(
        task("transfer", {
          data: {
            from: this.fundAddress,
            to: userWallet,
            amount,
          },
        })
      );
    const secondTx = () =>
      getTxFor(
        task("transfer", {
          data: {
            to,
            amount,
          },
          index: userId,
        })
      );
    return { firstTx, secondTx };
  };

  getWalletAddress = async (userId: string | number) => {
    try {
      const data = await task("sign", {
        index: userId,
      });
      this.userIdToAddressMap[userId] = data.result.address;
      if (data.result) return data.result.address;
    } catch (e) {
      console.log(e);
      return null;
    }
  };
}
