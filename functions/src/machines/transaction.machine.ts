import { createMachine, ContextFrom, EventFrom } from "xstate";
import { createModel } from "xstate/lib/model";

export const txModel = createModel(
  {
    retries: 0,
    txHash: "",
    error: "",
  },
  {
    events: {
      submitted: () => ({}),
      adjusted: () => ({}),
      mined: (hash: string) => ({ hash }),
      rejected: (error: string) => ({ error }),
      errored: (error: string) => ({ error }),
      abort: (error: string) => ({ error }),
    },
  }
);

const increaseRetries = txModel.assign(
  {
    retries: (ctx) => ctx.retries + 1,
  },
  "adjusted"
);

const setTxHash = txModel.assign(
  {
    txHash: (_, event) => event.hash,
  },
  "mined"
);

const setAbortMessage = txModel.assign(
  {
    error: (_, event) => event.error,
  },
  "abort"
);

const setErrorMessage = txModel.assign(
  {
    error: (_, event) => event.error,
  },
  "errored"
);

const setRejectedMessage = txModel.assign(
  {
    error: (_, event) => event.error,
  },
  "rejected"
);

export type TxModelContext = ContextFrom<typeof txModel>;
export type TxModelEvents = EventFrom<typeof txModel>;

export const txMachine =
  /** @xstate-layout N4IgpgJg5mDOIC5QBcAeA6ADmAdhAljlAMSwCuARgLb7LKQDaADALqKiYD2st+nO7EKkQBGABxN0YiSICc8gMwAWAGwB2JrKUAaEAE9ECgKwr0AJjlGlao-NlmFsgL5PdaLLgJFiYAE6-OX0ZWQS4eZD4BJCFRCSkZO2V1TR19RDMjEXQ1M1lNMSMxDREzMRc3DGw8QhIAQwpA5GY2aLDefkFhBHFJaSY5RVUNLV0DBCMNcw01cREVJhNrcpB3TACAYzgebyCAKzB1+ghm0O52qNAupSUxdCYJDSYmBQUmDVSxhTUFc2eFsw0pWKy1WGy2NWINBwwRaHDOEQ60SuSh+uRR12u6gUIg+iEyPwU0nESlkEiMTBURhBGAAZrV8AAbSDEWoQXZkWBHE6teGRTqIa63e5vJ7PV7vUaIMRmdCyFTGV6koyEkRqanoOmM5ncuHhPlIxAzWSyowmMQiC3khQAyUIDJqcyvRxmJ4qVWyNXLHCcCBwQSrTw1U56xGXAVmW0Wh2FArPHJMXJm9VrTibWDbKDB878hDYpTZMQqa4WHFKTIiW2EyTGBy2LQmNSeioa+lMiBZhEXGLjMT5phKTTfXtJMwRtJ2qzZOaaa2yESFFRlVwrDDkdZp+A8kNdroTLLfWSmgdaCxz22CgtmVQA5RiGtKdX1RqQDv6sMIMRyqQN6z9JJyW0zDdKRG2VCxrXNCQFGpV9Q27ABaFRbUQlwXCAA */
  createMachine(
    {
      context: txModel.initialContext,
      schema: { context: {} as TxModelContext, events: {} as TxModelEvents },
      initial: "pending",
      states: {
        pending: {
          on: {
            submitted: {
              target: "processing",
            },
            errored: {
              target: "failed",
              actions: setErrorMessage,
            },
            abort: {
              target: "aborted",
              actions: setAbortMessage,
            },
          },
        },
        processing: {
          on: {
            rejected: {
              target: "failed",
              actions: setRejectedMessage,
            },
            mined: {
              target: "success",
              actions: setTxHash,
            },
          },
        },
        failed: {
          always: {
            target: "aborted",
            cond: "maxedRetries",
          },
          on: {
            adjusted: {
              target: "pending",
              actions: increaseRetries,
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
          return ctx.retries >= 4;
        },
      },
    }
  );
