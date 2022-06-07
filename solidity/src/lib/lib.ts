import * as ethers from "ethers";
import { abi as tokenAbi } from "../../artifacts/src/contracts/RibusToken.sol/RibusToken.json";
import { abi as forwarderAbi } from "../../artifacts/src/contracts/UpgradeableForwarder.sol/UpgradeableForwarder.json";
import d from "../../deploy.json";
import { RibusToken, UpgradeableForwarder } from "../../typechain";
import Network from "./network";
import { onboardSignMetaTxRequest } from "./signer";
import { chainIdToName, toChainId } from "./utils";
import Onboard, { OnboardAPI } from "@web3-onboard/core";
import injectedModule from "@web3-onboard/injected-wallets";
// import walletConnectModule from "@web3-onboard/walletconnect";
import { RibusTransferJWT } from "../types";

const injected = injectedModule();
// const walletConnect = walletConnectModule();

const { task } = Network.shared;
const deploy = d as any;

type MakeLibsConfig = {
  contractAddress?: string;
  forwarderAddress?: string;
  fundAddress?: string;
  network?: ethers.ethers.providers.Networkish;
};

export default class RibusSdk {
  provider: ethers.providers.JsonRpcProvider;
  RibusContract: RibusToken;
  Forwarder: UpgradeableForwarder;
  userIdToAddressMap: Record<string, string> = {};
  fundAddress: string;
  onboard: OnboardAPI;
  constructor(config: MakeLibsConfig = {}) {
    const { contractAddress, forwarderAddress, fundAddress, network } = config;
    const tokenAddress =
      contractAddress || deploy[chainIdToName[Network.shared.chainId]].token;
    const forwarderAddr =
      forwarderAddress ||
      deploy[chainIdToName[Network.shared.chainId]].forwarder;

    this.provider = new ethers.providers.JsonRpcProvider(
      Network.shared.RPC_URL,
      network
    );
    this.Forwarder = new ethers.Contract(forwarderAddr, forwarderAbi).connect(
      this.provider
    ) as UpgradeableForwarder;
    this.RibusContract = new ethers.Contract(tokenAddress, tokenAbi).connect(
      this.provider
    ) as RibusToken;

    this.fundAddress = fundAddress || ethers.constants.AddressZero;
    this.onboard = Onboard({
      wallets: [
        injected,
        // , walletConnect
      ],
      chains: [
        {
          id: toChainId(80001),
          token: "MATIC",
          rpcUrl: Network.shared.RPC_URL,
          label: "Polygon Testnet (Mumbai)",
        },
      ],
      appMetadata: {
        name: "Ribus App",
        icon: "https://app.ribus.com.br/img/logo-ribus-principal.svg", // svg string icon
        description: "Soluções em blockchain para o mercado imobiliário.",
      },
    });
  }

  addToken = () =>
    this.getSigner().then((wallet) =>
      wallet.provider.request({
        method: "wallet_watchAsset",
        params: {
          // @ts-ignore
          type: "ERC20", // Initially only supports ERC20, but eventually more!
          options: {
            address: this.RibusContract.address, // The address that the token is at.
            symbol: "RIB", // A ticker symbol or shorthand, up to 5 chars.
            decimals: 8, // The number of decimals in the token
            image:
              "https://res.cloudinary.com/brunocangs/image/upload/c_crop,h_1930/v1654641458/Co%CC%81pia_de_RIBUS_MOEDA_ICONE-05_u7pkrm.png", // A string url of the token logo
          },
        },
      })
    );

  signer = (address: string) => new ethers.VoidSigner(address, this.provider);
  getTransaction = (txHash: string) => this.provider.getTransaction(txHash);
  send = (signedTx: string | Promise<string>) =>
    this.provider.sendTransaction(signedTx);

  balanceOf = (address: string) => this.RibusContract.balanceOf(address);
  burnData = (amount: number) => ({
    to: this.RibusContract.address,
    data: this.RibusContract.interface.encodeFunctionData("burn", [amount]),
  });

  getTxFor = (prom: Promise<{ result: { hash: string } }>) =>
    prom.then((taskReturn) => {
      const { result } = taskReturn;
      return this.getTransaction(result.hash);
    });

  getSigner = async () => {
    const [wallet] = await this.onboard.connectWallet();
    return wallet;
  };

  burnExternal = async (amount: number) => {
    const signer = await this.getSigner();
    const { request, signature } = await onboardSignMetaTxRequest(
      new ethers.providers.Web3Provider(signer.provider),
      this.Forwarder,
      {
        from: signer.accounts[0].address,
        ...this.burnData(amount),
      }
    );
    return () =>
      this.getTxFor(
        task("relay", {
          request,
          signature,
        })
      );
  };
  claimRibusJWT = async (jwt: string) => {
    try {
      const [, content] = jwt.split(".");
      const data: RibusTransferJWT = JSON.parse(atob(content));
      return this.claimRibus(data.user_id, data.wallet, data.amount, jwt);
    } catch (err) {
      console.error(err);
    }
  };
  private claimRibus = async (
    userId: string | number,
    to: string,
    amount: number,
    jwt?: string
  ) => {
    if (!this.userIdToAddressMap[userId]) await this.getWalletAddress(userId);
    // Get current userWallet balance
    // Move only difference => Fixing mechanic
    // Move logic to queue on firebase
    const userWallet = this.userIdToAddressMap[userId];
    const firstTx = () =>
      this.getTxFor(
        task("transfer", {
          data: {
            from: this.fundAddress,
            to: userWallet,
            amount,
          },
          jwt,
        })
      );
    const secondTx = () =>
      this.getTxFor(
        task("transfer", {
          data: {
            to,
            amount,
          },
          index: userId,
          jwt,
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
      console.error(e);
      return null;
    }
  };
}
