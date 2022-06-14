import axios from "axios";
import { chainIdToAutotasks, chainIdToRpc, TaskNames } from "./utils";
class Network {
  static shared = new Network();
  RPC_URL = process.env.RPC_URL || "http://localhost:8545";
  chainId = 31337;
  setRpcUrl(url: string) {
    this.RPC_URL = url;
  }
  setChainId(chainId: number) {
    this.chainId = chainId;
    this.setRpcUrl(chainIdToRpc[chainId]);
  }
  task = async (task: TaskNames, params: any) => {
    const data = await axios(chainIdToAutotasks[this.chainId][task], {
      method: "post",
      data: params,
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (data.data) {
      return data.data;
    }
  };
}

export default Network;
