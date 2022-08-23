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

export const txMachine = createMachine(
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
        return ctx.retries >= 50;
      },
    },
  }
);
