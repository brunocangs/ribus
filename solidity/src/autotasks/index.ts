import { Relayer } from "defender-relay-client";
import { RelayerModel, RelayerParams } from "defender-relay-client/lib/relayer";

// Entrypoint for the Autotask

export const handler = async (credentials: RelayerParams) => {
  const relayer = new Relayer(credentials);
  const info: RelayerModel = await relayer.getRelayer();
  console.log(`Relayer address is ${info.address}`);
};

// Sample typescript type definitions
type EnvInfo = {
  DEFENDER_API_KEY: string;
  DEFENDER_API_SECRET: string;
};

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require("dotenv").config();
  const { DEFENDER_API_KEY: apiKey, DEFENDER_API_SECRET: apiSecret } =
    process.env as EnvInfo;
  handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });
}
