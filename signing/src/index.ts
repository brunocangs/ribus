import express from "express";
import { env } from "./lib/env";
import enforceAuth from "./middleware/enforceAuth";
import rootRouter from "./router";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());

app.use(rootRouter);
app.use(enforceAuth);

app.get(`/`, (_, res) => {
  res.send({
    success: true,
  });
});

app.listen(env.PORT, () => {
  console.log(`Server listening on ${env.PORT}`);
});
