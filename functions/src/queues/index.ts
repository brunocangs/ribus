import * as functions from "firebase-functions";

export const requiredSecrets = ["SEED"];

export const testQueue = functions.tasks
  .taskQueue({
    rateLimits: {
      maxConcurrentDispatches: 2,
    },
  })
  .onDispatch(async (data) => {
    console.log(`Dispatched`, Date.now());
    new Promise((res) => setTimeout(res, 5000)).then(() => {
      console.log(data);
    });
  });
