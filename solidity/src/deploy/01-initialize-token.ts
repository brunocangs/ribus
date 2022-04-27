import axios from "axios";
import { DeployFunction } from "hardhat-deploy/types";
import { RibusToken } from "../../typechain";
import Network from "../lib/network";

const { url } = Network.shared;
// This should never run on production
// never
// For real

const func: DeployFunction = async (hre) => {
  const { ethers, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const ribus: RibusToken = await ethers.getContract("RibusToken");
  const req = await axios(url(`/wallets`));
  const wallets: Array<{ address: string }> = req.data;
  const percentages = Array.from(wallets, () => 100 / wallets.length);
  const addresses = wallets.map(({ address }) => address);
  addresses.splice(-1, 1, deployer);
  let tx = await ribus.init(addresses, percentages);
  await tx.wait();
  const rs = async () => {};
  rs.isDefined = true;
  await hre.tasks["fund-many"].action({ first: 10 }, hre, rs);
};

func.tags = ["dev"];

export default func;
