import { Router } from "express";
import txRouter from "./transactions";
import { walletRouter } from "./wallets";

const rootRouter = Router();

rootRouter.use(`/wallets`, walletRouter);
rootRouter.use(`/transactions`, txRouter);

export default rootRouter;
