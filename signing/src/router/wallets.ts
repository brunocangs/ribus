import { Router } from "express";
import { getWalletManager } from "../lib/walletManager";

const walletRouter = Router();

walletRouter.get("/:index", async (req, res) => {
  const manager = getWalletManager();
  res.json(manager.getChild(+req.params.index));
});

export { walletRouter };
