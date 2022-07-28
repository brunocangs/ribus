import { createMachine, ContextFrom, EventFrom } from "xstate";
import { createModel } from "xstate/lib/model";

export const txModel = createModel(
  {
    retries: 0,
    infuraHash: "",
    txHash: "",
  },
  {
    events: {
      submitted: (hash: string) => ({ hash }),
      adjusted: () => ({}),
      mined: (hash: string) => ({ hash }),
      rejected: () => ({}),
      errored: () => ({}),
    },
  }
);

const increaseRetries = txModel.assign(
  {
    retries: (ctx) => ctx.retries + 1,
  },
  "adjusted"
);

const setInfuraHash = txModel.assign(
  {
    infuraHash: (_, event) => event.hash,
  },
  "submitted"
);

const setTxHash = txModel.assign(
  {
    txHash: (_, event) => event.hash,
  },
  "mined"
);

export type TxModelContext = ContextFrom<typeof txModel>;
export type TxModelEvents = EventFrom<typeof txModel>;

export const txMachine =
  /** @xstate-layout N4IgpgJg5mDOIC5QBcAeA6ADmAdhAljlAMSwCuARgLb7LKSKiYD2st+zOjIqiAjADYAnOgAsABgAckgKwAmGZKEB2cTJkCANCACeiJeiEDJymeKFmAzHMkCAvne1osuAkWJgATp+aeGSEBY2ZA4uAN4EQREJaXlFFTUNbT0ESxN0NKFrZVE+dTllOQcnDEwfAGM4Nnc-ACswcvoIbiD2Tm4ImVEBMW6BcQG5S0shaWT+GWV0WWU0gQE+S2VlftFikGcy5krYapIaHH8mVjaw0E6ZS3QBWb5Ta2FL5XHUnuUVNJMNPlEVrvXnAAzACG+AANpBiMCILUyLAmi0TiF2uFEKI5D1LKIlPJJOIBMNzC85DZDJYFiohEJRJY+EZLACMCDwZDEcFQh1EAJFNNlJJRDJ6QIBWpiWl0KZVCKqap5MoHI4QDhmBA4NxNq5CFA2adOQh0S8+Hd0HSJHxxAobktfoysBUqlqdcizjxEJZzOh8SpZLZzXJcobxFcBXxJP73ljadTbcyIc0Aq1nXr1KJ0HJRncFhbycZiejDHSCgTZCoFvZFc5yOUdvAE0iOaiEEI8ibvbZhap3jIXu601lsUHBOJugLbcCKL4EXX2Sjzohm+I03wCnkBEMpEtifyl-NRBmTGpJAyKxFjjOXRFQy8ALS5a6mDF8oyC5t8BV2IA */
  createMachine(
    {
      context: txModel.initialContext,
      schema: { context: {} as TxModelContext, events: {} as TxModelEvents },
      initial: "pending",
      states: {
        pending: {
          on: {
            submitted: {
              actions: setInfuraHash,
              target: "processing",
            },
            errored: {
              target: "failed",
            },
          },
        },
        processing: {
          on: {
            rejected: {
              target: "failed",
            },
            mined: {
              actions: setTxHash,
              target: "success",
            },
          },
        },
        failed: {
          always: {
            cond: "maxedRetries",
            target: "aborted",
          },
          on: {
            adjusted: {
              actions: increaseRetries,
              target: "pending",
            },
          },
        },
        success: {
          type: "final",
        },
        aborted: {
          type: "final",
        },
      },
      id: "tx",
    },
    {
      guards: {
        maxedRetries: (ctx) => {
          return ctx.retries >= 5;
        },
      },
    }
  );
