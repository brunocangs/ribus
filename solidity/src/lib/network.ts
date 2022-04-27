class Network {
  static shared = new Network();
  API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
  RPC_URL = process.env.RPC_URL || "http://localhost:8545";
  setBaseUrl(url: string) {
    this.API_BASE_URL = url;
  }
  setRpcUrl(url: string) {
    this.RPC_URL = url;
  }
  url = (path: string) => {
    return this.API_BASE_URL + path;
  };
}

export default Network;
