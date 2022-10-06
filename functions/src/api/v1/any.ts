import { Router } from "express";

const anyRouter = Router();

anyRouter.use("*", (req, res) => {
  console.log(`Received ${req.method} ${req.baseUrl}`, req.body);
  res.json({
    success: true,
    path: req.baseUrl,
    body: req.body,
  });
});

export { anyRouter };
