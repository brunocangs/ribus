import { TransactionRequest } from "@ethersproject/providers";
import axios from "axios";
import * as ethers from "ethers";
import { abi } from "../../artifacts/src/contracts/RibusToken.sol/RibusToken.json";
import type { RibusToken } from "../../typechain";
import Network from "./network";

const { url } = Network.shared;

type MakeLibsConfig = {
  contractAddress: string;
  // fundAddress: string;
  network?: ethers.ethers.providers.Networkish;
};

export default class RibusSdk {
  provider: ethers.providers.JsonRpcProvider;
  RibusContract: RibusToken;

  constructor(config: MakeLibsConfig) {
    const { contractAddress, network } = config;
    this.provider = new ethers.providers.JsonRpcProvider(
      Network.shared.RPC_URL,
      network
    );
    this.RibusContract = new ethers.Contract(contractAddress, abi).connect(
      this.provider
    ) as RibusToken;
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
      const { data } = await axios(url("/transactions/sign"), {
        method: "post",
        headers,
        data: tx,
      });
      if (data) return data;
      return null;
    } catch (e) {
      return null;
    }
  };
  send = (signedTx: string | Promise<string>) =>
    this.provider.sendTransaction(signedTx);

  signAndSend = async (tx: TransactionRequest | Promise<TransactionRequest>) =>
    this.signTransaction(await tx).then((signed) => this.send(signed));

  getMaxGasCost = (tx: TransactionRequest) => {
    if (tx.gasLimit && tx.maxFeePerGas) {
      const gasLimit = tx.gasLimit as ethers.BigNumber;
      const maxFeePerGas = tx.maxFeePerGas as ethers.BigNumber;
      return gasLimit.mul(maxFeePerGas);
    }
    return null;
  };

  walletHasFundsForGas = async (address: string, tx: TransactionRequest) => {
    const { getMaxGasCost, provider } = this;

    const gasCostInWei = getMaxGasCost(tx);
    if (!gasCostInWei) return false;
    const balance = await provider.getBalance(address);
    return balance.gte(gasCostInWei);
  };

  claimRibusTx = async (from: string, to: string, amount: number) => {
    const { signer, RibusContract } = this;

    const sender = signer(from);
    const txToSign = await RibusContract.populateTransaction
      .transfer(to, amount)
      .then((tx) => sender.populateTransaction(tx));
    return txToSign;
  };

  claimRibus = async (
    from: string,
    to: string,
    amount: number
    // certify?: boolean
  ) => {
    const { claimRibusTx, signAndSend } = this;

    const tx = await claimRibusTx(from, to, amount);
    // if (certify) {
    //   await certifyWalletCanPayForGas(tx);
    // }
    return signAndSend(tx);
  };

  getWalletAddress = async (userId: string | number) => {
    try {
      const data = await axios(url(`/wallets/${userId}`));
      if (data.data) return data.data.address;
    } catch (e) {
      console.log(e);
      return null;
    }
  };
}
