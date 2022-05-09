export const chainIdToName: Record<number, string> = {
  80001: "mumbai",
  31337: "localhost",
};

export const chainIdToRpc: Record<number, string> = {
  31337: "http://localhost:8545",
  80001: "https://polygon-mumbai.infura.io/v3/5554892250224defb6c817ddb2755733",
};

export type TaskNames = "transfer" | "sign" | "relay";

export const chainIdToAutotasks: Record<number, Record<TaskNames, string>> = {
  31337: {
    relay: "",
    sign: "",
    transfer: "",
  },
  80001: {
    relay:
      "https://api.defender.openzeppelin.com/autotasks/f65013f5-5edc-4d9e-a677-f80e1ab32cc4/runs/webhook/fef8fade-5f57-460d-80c9-bc8749abdd39/x5oT8LTqzYW9dwETwQXyA",
    sign: "https://api.defender.openzeppelin.com/autotasks/e8273f76-fed8-491d-91dc-54ec5a31ff62/runs/webhook/fef8fade-5f57-460d-80c9-bc8749abdd39/8enkHaqu62bAP83BQL1AUf",
    transfer:
      "https://api.defender.openzeppelin.com/autotasks/8397348b-fb30-43e6-9711-1674b424bbb4/runs/webhook/fef8fade-5f57-460d-80c9-bc8749abdd39/L59bopGHSDSGY7qmAeEWmT",
  },
};
