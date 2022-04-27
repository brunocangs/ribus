import { expect } from "chai";
import { deployments, getUnnamedAccounts, ethers } from "hardhat";
import { NamedAccounts } from "../types";
import { RibusToken } from "./../../typechain";

const setupTest = deployments.createFixture(
  async ({ deployments, ethers, getNamedAccounts }) => {
    const { deployer } = (await getNamedAccounts()) as NamedAccounts;
    await deployments.deploy("RibusToken", {
      from: deployer,
      args: [deployer],
      skipIfAlreadyDeployed: false,
    });
    const [, ...rest] = await ethers.getSigners();
    return {
      tokenContract: (await ethers.getContract(`RibusToken`)) as RibusToken,
      deployer: await ethers.getSigner(deployer),
      signers: rest,
    };
  }
);

describe("Ribus Token", function () {
  it("Should deploy and set correct owner", async () => {
    const { tokenContract, deployer } = await setupTest();
    const owner = await tokenContract.owner();
    expect(owner).to.equal(deployer.address);
  });
  it("Should deploy and distribute tokens according to percentages", async function () {
    const { tokenContract } = await setupTest();
    const tokenSupply = (await tokenContract.supply()).toNumber();
    const unnamed = await getUnnamedAccounts();
    const validPercentages = [20, 30, 40, 10];
    const wallets = unnamed.slice(0, validPercentages.length);
    let tx = await tokenContract.init(wallets, validPercentages);
    await tx.wait();
    for (const index in wallets) {
      const wallet = wallets[index];
      const percentage = validPercentages[index];
      const tokenCount = (tokenSupply * percentage) / 100;
      expect(await tokenContract.balanceOf(wallet)).to.equal(tokenCount);
    }
  });
  it("Should fail when percentages dont add to 100%", async () => {
    const { tokenContract } = await setupTest();
    const unnamed = await getUnnamedAccounts();
    const invalidPercentagesLess = [20, 20, 20, 20];
    const wallets = unnamed.slice(0, invalidPercentagesLess.length);
    try {
      await tokenContract.init(wallets, invalidPercentagesLess);
      // This should never happen. Will cause test to fail
      expect(false).to.equal(true);
    } catch (e: any) {
      expect(e.message).to.contain(`Invalid input`);
    }
  });
  it("Should fail when percentages go over 100%", async () => {
    const { tokenContract } = await setupTest();
    const unnamed = await getUnnamedAccounts();
    const invalidPercentagesMore = [30, 30, 30, 30];
    const wallets = unnamed.slice(0, invalidPercentagesMore.length);
    try {
      await tokenContract.init(wallets, invalidPercentagesMore);
      // This should never happen. Will cause test to fail
      expect(false).to.equal(true);
    } catch (e: any) {
      expect(e.message).to.contain(`Invalid input`);
    }
  });
  it("Should fail if trying to initialize twice", async () => {
    const { tokenContract } = await setupTest();
    const unnamed = await getUnnamedAccounts();
    const validPercentages = [20, 30, 40, 10];
    const wallets = unnamed.slice(0, validPercentages.length);
    let tx = await tokenContract.init(wallets, validPercentages);
    await tx.wait();
    const moreWallets = unnamed.slice(
      validPercentages.length,
      validPercentages.length
    );
    try {
      tx = await tokenContract.init(moreWallets, validPercentages);
      tx = await tokenContract.init(moreWallets, validPercentages);
    } catch (e: any) {
      expect(e.message).to.contain(`already initialized`);
    }
  });
  it("Decreases total supply when burning tokens", async () => {
    const { tokenContract } = await setupTest();
    const unnamed = await getUnnamedAccounts();
    const validPercentages = [20, 30, 40, 10];
    const wallets = unnamed.slice(0, validPercentages.length);
    let tx = await tokenContract.init(wallets, validPercentages);
    await tx.wait();
    const burner = await ethers.getSigner(wallets[0]);
    const burnerTokenInstance = tokenContract.connect(burner);
    const supply = await tokenContract.totalSupply();
    tx = await burnerTokenInstance.burn(
      await burnerTokenInstance.balanceOf(burner.address)
    );
    await tx.wait();
    const supplyAfter = await tokenContract.totalSupply();
    expect(supplyAfter.lt(supply));
  });
});
