import { Request, Response, NextFunction } from "express";

const enforceAuth = (req: Request, res: Response, next: NextFunction) => {
  // TODO
  next();
};

export default enforceAuth;
