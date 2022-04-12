import { Wallet } from "ethers";
import { HDNode, defaultPath } from "ethers/lib/utils";
import { env } from "./env";
import { getWalletPathAt } from "./utils";
import fs from "fs";
import path from "path";

export class WalletManager {
  private encryptedWallet: string;
  private unlockedWallet?: HDNode;
  constructor(
    encryptedWalletJsonString: string = fs
      .readFileSync(path.resolve(__dirname, "wallet.json"))
      .toString()
  ) {
    this.encryptedWallet = encryptedWalletJsonString;
  }
  unlock(password: string) {
    this.unlockedWallet = HDNode.fromMnemonic(
      Wallet.fromEncryptedJsonSync(this.encryptedWallet, password).mnemonic
        .phrase
    );
  }
  lock() {
    this.unlockedWallet = undefined;
  }
  getChild(index: number) {
    if (!this.unlockedWallet) return;
    return this.unlockedWallet.derivePath(getWalletPathAt(index));
  }
}

const manager = new WalletManager();
manager.unlock(env.MASTER_PASSWORD);
export const getWalletManager = () => manager;
