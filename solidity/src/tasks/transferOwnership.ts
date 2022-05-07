import { task } from "hardhat/config";
import d from "../../deploy.json";
import { RibusTokenV2 } from "../../typechain";

const deploy = d as Record<string, Record<string, string>>;

task("transfer")
  .addParam("address", "New address to set as proxy admin")
  .setAction(async (args, { ethers, network }) => {
    const newAdmin = args.address;
    console.log(`Starting transfer process to ${newAdmin}`);
    const tokenProxy = deploy[network.name].token;
    const Ribus = await ethers.getContractFactory("RibusTokenV2");
    const tokenContract = Ribus.attach(tokenProxy) as RibusTokenV2;
    if (!tokenProxy)
      throw new Error(`No token proxy on network ${network.name}`);
    const tx = await tokenContract.transferOwnership(newAdmin);
    console.log(
      `Submitted transaction for chaging contract admin at ${tx.hash}`
    );
    await tx.wait();
    console.log(`Set RibusToken proxy admin to ${newAdmin} on ${network.name}`);
  });
