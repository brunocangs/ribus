import { runWith } from "firebase-functions";
import { processTxs } from "../utils/processTxs";

const secrets = ["SEED", "JWT_SECRET"];

export const progressStates = runWith({
  secrets,
})
  .pubsub.schedule("every minute")
  .onRun(async () => {
    console.log(`Called CRON`);
    await processTxs();
    return null;
  });
