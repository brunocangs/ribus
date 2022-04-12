import { DeployFunction } from "hardhat-deploy/types";
import { NamedAccounts } from "../types";

const func: DeployFunction = async (hre) => {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = (await getNamedAccounts()) as NamedAccounts;
  await deploy("RibusToken", {
    from: deployer,
    args: [deployer],
    log: true,
  });
};

func.tags = ["dev", "staging"];

export default func;
