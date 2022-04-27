import { ethers } from "ethers";
import { Router } from "express";
import { WalletManager } from "../lib/walletManager";
import { signRouteHandler } from "./transactions";

const walletRouter = Router();

walletRouter.get("/:index", async (req, res) => {
  const manager = WalletManager.shared;
  const wallet = manager.getChild(+req.params.index);
  if (!wallet) return res.status(404);
  res.json({
    address: wallet.address,
  });
});

walletRouter.get("/", async (req, res) => {
  const manager = WalletManager.shared;
  const wallets = manager.getChildren().map((wallet, index) => {
    if (!wallet) return { index };
    const { address } = wallet;
    return { address, index };
  });
  res.json(wallets);
});

export { walletRouter };
