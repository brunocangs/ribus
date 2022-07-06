import { Router } from "express";

const anyRouter = Router();

anyRouter.use("*", (req, res) => {
  console.log(`Received ${req.method} ${req.path}`, req.body);
  res.json({
    success: true,
  });
});

export { anyRouter };
