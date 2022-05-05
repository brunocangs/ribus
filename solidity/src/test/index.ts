import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { providers, Wallet } from "ethers";
import { HDNode, defaultPath } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import { signMetaTxRequest } from "../lib/signer";
import {
  MinimalForwarderUpgradeable,
  RibusToken,
  RibusTokenV2,
} from "../../typechain";

describe("Greeter", function () {
  this.beforeAll(async function () {
    // Parent custodiated wallet => Generates children wallet
    const parentNode = HDNode.fromMnemonic(
      (await ethers.Wallet.createRandom()).mnemonic.phrase
    );
    // Relayer wallet (wallet with funds to submit meta tx)
    const [relayer] = await ethers.getSigners();
    // User 1 wallet => Will sign meta tx
    const firstUser = new ethers.Wallet(
      parentNode.derivePath(defaultPath.slice(0, -1) + "1").privateKey,
      relayer.provider
    );
    // User 2 wallet => Could be any wallet. Will receive the RIB
    const secondUser = new ethers.Wallet(
      parentNode.derivePath(defaultPath.slice(0, -1) + "2").privateKey,
      relayer.provider
    );
    // Send funds to base wallet for non-meta tx
    await relayer.sendTransaction({
      to: parentNode.address,
      value: ethers.utils.parseEther("1"),
    });
    Object.assign(this, { parentNode, firstUser, secondUser, relayer });
  });
  it("Should deploy V1 contract and Forwarder", async function () {
    const Ribus = await ethers.getContractFactory("RibusToken");
    const Forwarder = await ethers.getContractFactory("UpgradeableForwarder");
    const forwarder = await upgrades.deployProxy(Forwarder);

    const constructorArgs = [forwarder.address];
    const instance = (await upgrades.deployProxy(Ribus, {
      constructorArgs,
    })) as RibusToken;

    expect(await instance.isTrustedForwarder(forwarder.address)).to.true;
    expect(await instance.version()).to.eq("1.0.0");

    this.token = instance;
    this.forwarder = forwarder;
  });
  it("Should upgrade to V2 correctly", async function () {
    const Ribus = this.token as RibusToken;
    const Forwarder = this.forwarder as MinimalForwarderUpgradeable;

    const RibusV2 = await ethers.getContractFactory("RibusTokenV2");

    const upgraded = (await upgrades.upgradeProxy(Ribus.address, RibusV2, {
      constructorArgs: [Forwarder.address],
    })) as RibusTokenV2;

    expect(await upgraded.version()).to.eq("2.0.0");
    this.token = upgraded;
  });
  it("Should perform token distribution", async function () {
    const RibusV2 = this.token as RibusTokenV2;
    const signers = await ethers.getSigners();
    const parts = 5;
    const wallets = signers.slice(0, parts).map((signer) => signer.address);
    const percentages = wallets.map(() => 100 / parts);

    let tx = await RibusV2.distribute(wallets, percentages);
    await tx.wait();

    const supply = await RibusV2.totalSupply();

    for (const address of wallets) {
      const walletBalance = await RibusV2.balanceOf(address);
      expect(walletBalance.eq(supply.div(parts)));
    }
    // Pick last wallet as funds holder (ICO bank)
    this.holder = await ethers.getSigner(wallets[4]);
  });
  it("Should transfer to custodiated wallet", async function () {
    const holder = this.holder as SignerWithAddress;
    const firstUser = this.firstUser as Wallet;
    const parentNode = this.parentNode as HDNode;
    const RibusV2 = this.token as RibusTokenV2;
    const ALLOWANCE = 100000;
    // Set allowance from holder to parentNode
    let tx = await RibusV2.connect(holder).increaseAllowance(
      parentNode.address,
      ALLOWANCE
    );
    await tx.wait();
    // Parent Node transfer from holder to child address (non meta)
    const parentWallet = new Wallet(parentNode.privateKey, holder.provider);
    tx = await RibusV2.connect(parentWallet).transferFrom(
      holder.address,
      firstUser.address,
      ALLOWANCE / 2
    );
    await tx.wait();
    const childBalance = await RibusV2.balanceOf(firstUser.address);
    expect(childBalance.eq(ALLOWANCE / 2));
  });
  it("Should transfer from custodiated wallet via meta-tx", async function () {
    const firstUser = this.firstUser as Wallet;
    const relayer = this.relayer as SignerWithAddress;
    const forwarder = this.forwarder.connect(
      relayer
    ) as MinimalForwarderUpgradeable;
    const secondUser = this.secondUser as Wallet;
    const RibusV2 = this.token as RibusTokenV2;
    const ALLOWANCE = 100000;
    const { request, signature } = await signMetaTxRequest(
      // Have to use private key here because of hardhat not managing this key => Key was generated
      // @ts-ignore
      firstUser.privateKey,
      forwarder,
      {
        from: firstUser.address,
        to: RibusV2.address,
        data: RibusV2.interface.encodeFunctionData("transfer", [
          secondUser.address,
          ALLOWANCE / 2,
        ]),
      }
    );
    await forwarder.execute(request, signature).then((tx) => tx.wait());
    const ribBalance = await RibusV2.balanceOf(secondUser.address);
    const ethBalance = await firstUser.provider.getBalance(firstUser.address);
    // Check that RIB was transfered without user 1 having funds
    expect(ribBalance.eq(ALLOWANCE / 2));
    expect(ethBalance.eq(0));
  });
});
