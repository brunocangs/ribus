import axios from "axios";
import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const fundWallet = async (
  index: number,
  ethers: HardhatRuntimeEnvironment["ethers"]
) => {
  const {
    data: { address },
  } = await axios(`http://localhost:3000/wallets/${index}`);
  const [source] = await ethers.getSigners();
  const tx = await source.sendTransaction({
    to: address,
    value: ethers.utils.parseEther("5"),
  });
  await tx.wait();
  return address;
};

task(`fund`, `Authorizes a new wallet to the factory contract`)
  .addOptionalParam(`index`, `Wallet Index`, 1, types.int)
  .setAction(async (args, { ethers }) => {
    if (!args.index) return;
    try {
      const address = await fundWallet(+args.index, ethers);
    } catch (e) {
      console.error(`Error funding wallet`);
      console.error(e);
    }
  });

export const fundManyAction = async (
  args: any,
  { ethers }: HardhatRuntimeEnvironment
) => {
  try {
    const addresses = await Promise.all(
      Array.from({ length: args.first || 10 }, (_, i) =>
        fundWallet(i + 1, ethers)
      )
    );
    addresses.forEach((address) => {
      console.log(`Funded ${address} with 5 ETH on localhost`);
    });
  } catch (e) {
    console.error(`Error funding wallet`);
    console.error(e);
  }
};

task(`fund-many`, `Authorizes a new wallet to the factory contract`)
  .addOptionalParam(`first`, `Wallet Index`, 10, types.int)
  .setAction(fundManyAction);
