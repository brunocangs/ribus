import axios from "axios";
import { chainIdToAutotasks, TaskNames } from "./utils";
class Network {
  static shared = new Network();
  RPC_URL = process.env.RPC_URL || "http://localhost:8545";
  chainId = 31337;
  setRpcUrl(url: string) {
    this.RPC_URL = url;
  }
  setChainId(chainId: number) {
    this.chainId = chainId;
  }
  task = async (task: TaskNames, params: any) => {
    try {
      const data = await axios(chainIdToAutotasks[this.chainId][task], {
        method: "post",
        data: params,
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (data.data && data.data.result) {
        const result = JSON.parse(data.data.result);
        data.data.result = result;
        return data.data;
      }
    } catch (e) {
      console.error(e);
      return null;
    }
  };
}

export default Network;
