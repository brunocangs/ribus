import { Request, Response, Router } from "express";
import { WalletManager } from "../lib/walletManager";
import { validator as txValidator } from "../models/transactions";
const txRouter = Router();

export const signRouteHandler = async (req: Request, res: Response) => {
  try {
    // const values = txValidator.parse(req.body);
    const wallet = WalletManager.shared.getChildByAddress(req.body.from);
    if (!wallet) return res.sendStatus(404);
    console.log(req.body);
    res.send(await wallet.signTransaction(req.body));
  } catch (e) {
    console.error(e);
    res.status(500).json(e);
  }
};
txRouter.post("/sign", signRouteHandler);

export default txRouter;
