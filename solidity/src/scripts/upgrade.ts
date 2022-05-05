import { ethers, upgrades, network } from "hardhat";
import { writeFileSync } from "fs";
import d from "../../deploy.json";
const deploy = d as any;

const main = async () => {
  const RibusV2 = await ethers.getContractFactory("RibusTokenV2");
  const { token: proxy, forwarder } = deploy[network.name];
  if (!proxy || !forwarder)
    throw new Error("Cannot upgrade. Missing Proxy or Forwarder");
  const upgraded = await upgrades.upgradeProxy(proxy, RibusV2, {
    constructorArgs: [forwarder],
  });
  deploy[network.name].token = upgraded.address;
  console.log(`Upgraded to RibusV2 on address ${upgraded.address}`);
  writeFileSync("deploy.json", JSON.stringify(deploy, null, 2));
};

main();
