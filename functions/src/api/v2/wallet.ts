import { ethers } from "ethers";
import { Router } from "express";
import { getChildWallet } from "../../utils";
import d from "../../../../solidity/deploy.json";
import { chainIdToName } from "../../../../solidity/src/lib/utils";
import { abi as TokenAbi } from "../../../../solidity/artifacts/src/contracts/RibusToken.sol/RibusToken.json";
import { RibusToken } from "../../../../solidity/typechain";

const deploy = d as any;

export const walletRouter = Router();

walletRouter.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) return;
  const userWallet = getChildWallet(userId);
  const network = await userWallet.provider.getNetwork();
  const tokenContract = new ethers.Contract(
    deploy[chainIdToName[network.chainId]].token,
    TokenAbi,
    userWallet
  ) as RibusToken;
  const address = await userWallet.getAddress();
  res.json({
    address,
    balance: ethers.utils.formatUnits(
      await tokenContract.balanceOf(address),
      8
    ),
  });
});
