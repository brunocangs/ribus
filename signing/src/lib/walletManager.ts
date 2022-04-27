import { Wallet } from "ethers";
import { HDNode, defaultPath } from "ethers/lib/utils";
import { env } from "./env";
import { getWalletPathAt } from "./utils";
import fs from "fs";
import path from "path";

export class WalletManager {
  //
  static shared = new WalletManager();
  private encryptedWallet: string;
  private unlockedWallet?: HDNode;
  private addressToIndexMap: { [key: string]: number } = {};
  private preloadCount = 100;

  constructor(
    encryptedWalletJsonString: string = fs
      .readFileSync(path.resolve(__dirname, "wallet.json"))
      .toString(),
    newPreloadCount?: number
  ) {
    this.encryptedWallet = encryptedWalletJsonString;
    this.preloadCount = newPreloadCount || this.preloadCount;
  }

  unlock(password: string) {
    this.unlockedWallet = HDNode.fromMnemonic(
      Wallet.fromEncryptedJsonSync(this.encryptedWallet, password).mnemonic
        .phrase
    );
    for (let i = 0; i < this.preloadCount; i++) {
      const address = this.getChild(i)?.address;
      if (!address) continue;
      this.addressToIndexMap[address] = i;
    }
  }

  lock() {
    this.unlockedWallet = undefined;
  }

  getChild(index: number) {
    if (!this.unlockedWallet) return;
    const wallet = new Wallet(
      this.unlockedWallet.derivePath(getWalletPathAt(index)).privateKey
    );
    const { address } = wallet;
    if (!this.addressToIndexMap[address])
      this.addressToIndexMap[address] = index;

    return wallet;
  }

  getChildByAddress(address: string) {
    const childIndex = this.addressToIndexMap[address];
    if (!childIndex) {
      for (let i = this.preloadCount - 1; i < this.preloadCount * 10; i++) {
        const wallet = this.getChild(i);
        if (wallet && wallet.address === address) {
          console.log(`Found ${address} at index ${i}`);
          return wallet;
        }
      }
      console.log(`Failed to find wallet with address ${address}`);
      return;
    }
    return this.getChild(childIndex);
  }

  getChildren(start = 0, count = 10) {
    return Array.from({ length: count }, (_, i) => {
      const index = i + start + 1;
      return this.getChild(index);
    });
  }
}

WalletManager.shared.unlock(env.MASTER_PASSWORD);
