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
          id: toChainId(137),
          token: "MATIC",
          rpcUrl: Network.shared.RPC_URL,
          label: "Polygon",
        },
      ],
      appMetadata: {
        name: "Ribus App",
        icon: "https://app.ribus.com.br/img/logo-ribus-principal.svg", // svg string icon
        description: "Soluções em blockchain para o mercado imobiliário.",
      },
    });
  }
  switchNetwork = async () => {
    const wallet = await this.getSigner();
    try {
      await wallet.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + (137).toString(16) }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await wallet.provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainName: "Polygon",
                chainId: "0x" + (137).toString(16),
                rpcUrls: ["https://polygon-rpc.com/"],
                nativeCurrency: {
                  name: "Matic",
                  symbol: "MATIC",
                  decimals: 18,
                },
                blockExplorerUrls: ["https://polygonscan.com"],
              },
            ],
          });
        } catch (error: any) {
          console.log(error);
        }
      }
    }
  };
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
    let state = this.onboard.state.get();
    if (state.wallets.length === 0) await this.onboard.connectWallet();
    state = this.onboard.state.get();
    console.log(state);
    return state.wallets[0];
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

  claimRibus = async (jwt: string) => {
    return task("transfer", {
      from: this.fundAddress,
      jwt,
    });
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
