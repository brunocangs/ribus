import { credential } from "firebase-admin";
import { initializeApp } from "firebase-admin/app";

import devServiceAccount from "../service-account.dev.json";

initializeApp({
  credential: credential.cert(devServiceAccount as any),
});

export * from "./api";
export * from "./queues";
