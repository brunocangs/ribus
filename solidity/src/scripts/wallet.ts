import { ethers } from "ethers";

const main = async () => {
  if (!process.env.PASSWORD) throw new Error("Specify a wallet password");
  const wallet = ethers.Wallet.createRandom();
  const seed = ethers.utils.mnemonicToSeed(
    wallet.mnemonic.phrase,
    process.env.PASSWORD
  );
  console.log(
    `Generated wallet at ${wallet.address}\n========== MNEMONIC ==========\n${wallet.mnemonic.phrase}\n============ SEED ============\n${seed}`
  );
};

main();
