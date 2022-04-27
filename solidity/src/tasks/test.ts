import axios from "axios";
import { task } from "hardhat/config";
import { RibusToken } from "../../typechain";
import { RibusSdk } from "../lib";
import Network from "../lib/network";

const { url } = Network.shared;

/**
 * Task to test remote signing from the API
 * This logic will:
 * 1- Fetch wallets from the API
 *  1.1- This will populate some required fields on the api memory, like mapping the address to derivation index
 * 2- Populate wallet fields like none and gas values/estimation
 *  Note: Gas estimation may fail in cases where the account is unable to complete the tx.
 *  Fail example: Not enough tokens to transfer (try changing the walletOne address to something else)
 * 3- Send the transaction over to the server for signing
 * 4- Dispatch the signed transaction over to the RPC network
 */
task(`test-remote-signing`).setAction(async (_, hre) => {
  try {
    const { ethers } = hre;
    const RibusContract = (await ethers.getContract(
      "RibusToken"
    )) as RibusToken;

    const resp = await axios(url("/wallets"));
    const wallets: Array<{ address: string }> = resp.data;
    const SDK = new RibusSdk({
      contractAddress: RibusContract.address,
    });
    const { claimRibus } = SDK;

    const tx = await claimRibus(
      wallets[1].address,
      wallets[2].address,
      1012300
    );
    if (tx) {
      await tx.wait();
    } else {
      console.log("failed to build tx");
    }

    console.log(
      `Wallet 1 Ribus balance ${await RibusContract.balanceOf(
        wallets[1].address
      )}`
    );
    console.log(
      `Wallet 2 Ribus balance ${await RibusContract.balanceOf(
        wallets[2].address
      )}`
    );
  } catch (e) {
    console.log(`Caught here`);
    console.error(e);
  }
});
