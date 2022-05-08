import path from "path";
import { network } from "hardhat";
import { AutotaskClient } from "defender-autotask-client";
import { config } from "dotenv";

const MUMBAI_MAP = {
  relay: "f65013f5-5edc-4d9e-a677-f80e1ab32cc4",
  signing: "e8273f76-fed8-491d-91dc-54ec5a31ff62",
  transfer: "8397348b-fb30-43e6-9711-1674b424bbb4",
};

const taskIdNetworkMap: Record<string, Record<string, string>> = {
  hardhat: MUMBAI_MAP,
  mumbai: MUMBAI_MAP,
};

async function uploadCode(name: string, autotaskId: string) {
  const { TEAM_API_KEY: apiKey, TEAM_API_SECRET: apiSecret } = process.env;
  if (!apiKey || !apiSecret) throw new Error("Missing env");
  const client = new AutotaskClient({ apiKey, apiSecret });
  client.updateCodeFromSources;
  await client.updateCodeFromFolder(
    autotaskId,
    path.resolve(__dirname, `../../dist/tasks/${name}`)
  );
  console.log(`Task ${name} code updated - ${autotaskId}`);
}

async function main() {
  config();

  const tasksToUpload = Object.entries(taskIdNetworkMap[network.name]);
  if (!tasksToUpload) throw new Error("Invalid network");
  await Promise.all(
    tasksToUpload.map(([name, taskId]) => uploadCode(name, taskId))
  );
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
