import { ethers } from "ethers";
import { HDNode } from "ethers/lib/utils";
import { writeFileSync } from "fs";

const main = async () => {
  if (!process.env.PASSWORD) throw new Error("Specify a wallet password");
  const wallet = ethers.Wallet.createRandom();
  const seed = ethers.utils.mnemonicToSeed(
    wallet.mnemonic.phrase,
    process.env.PASSWORD
  );
  const node = HDNode.fromSeed(seed);
  console.log(
    `Generated wallet at ${wallet.address}\n========== MNEMONIC ==========\n${wallet.mnemonic.phrase}\n==============================\n${seed}`
  );
};

main();
