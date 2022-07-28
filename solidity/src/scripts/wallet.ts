import { ethers } from "ethers";

const main = async () => {
  if (!process.env.PASSWORD) throw new Error("Specify a wallet password");
  const wallet = ethers.Wallet.createRandom();

  const seed = ethers.utils.mnemonicToSeed(
    wallet.mnemonic.phrase
    // process.env.PASSWORD
  );
  const node = ethers.utils.HDNode.fromSeed(seed).derivePath(
    ethers.utils.defaultPath
  );
  const pk = node.privateKey;
  console.log(`\nPrivate key: ${pk}\nAddress: ${node.address}`);
  console.log(
    `========== MNEMONIC ==========\n${wallet.mnemonic.phrase}\n============ SEED ============\n${seed}\n`
  );
};

main();
