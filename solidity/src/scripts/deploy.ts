// scripts/create-box.js
import { ethers, upgrades, network } from "hardhat";
import { writeFileSync } from "fs";
import d from "../../deploy.json";
const deploy = d as any;

async function main() {
  const RibusToken = await ethers.getContractFactory("RibusToken");
  const MinimalForwarder = await ethers.getContractFactory(
    "UpgradeableForwarder"
  );
  let prevForwarderAddress = deploy[network.name]?.forwarder;
  // Always deploy on localhost
  if (network.config.chainId !== 31337 || !prevForwarderAddress) {
    const forwarder = await upgrades.deployProxy(MinimalForwarder);
    console.log("MinimalForwarder deployed to:", forwarder.address);
    prevForwarderAddress = forwarder.address;
  }
  const ribus = await upgrades.deployProxy(RibusToken, {
    constructorArgs: [prevForwarderAddress],
  });
  await ribus.deployed();
  console.log("RibusToken deployed to:", ribus.address);
  deploy[network.name] = {
    forwarder: prevForwarderAddress,
    token: ribus.address,
  };
  writeFileSync("deploy.json", JSON.stringify(deploy, null, 2));
}

main();
