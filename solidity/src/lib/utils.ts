import * as ethers from "ethers";
export const chainIdToName: Record<number, string> = {
  80001: "mumbai",
  31337: "localhost",
  137: "polygon",
};

export const chainIdToRpc: Record<number, string> = {
  31337: "http://localhost:8545",
  80001: "https://polygon-mumbai.infura.io/v3/5554892250224defb6c817ddb2755733",
  137: "https://polygon-mainnet.infura.io/v3/5554892250224defb6c817ddb2755733",
};

export type TaskNames = "transfer" | "sign" | "relay";

export const hardhatWallet = ethers.Wallet.fromMnemonic(
  "test test test test test test test test test test test junk"
);

export const chainIdToAutotasks: Record<number, Record<TaskNames, string>> = {
  31337: {
    relay: "http://localhost:5001/ribus-demo/us-central1/api/relay",
    sign: "http://localhost:5001/ribus-demo/us-central1/api/sign",
    transfer: "http://localhost:5001/ribus-tecnologia/us-central1/api/transfer",
  },
  80001: {
    relay: "https://us-central1-ribus-demo.cloudfunctions.net/api/relay",
    sign: "https://us-central1-ribus-demo.cloudfunctions.net/api/sign",
    transfer: "https://us-central1-ribus-demo.cloudfunctions.net/api/transfer",
  },
  137: {
    relay: "https://us-central1-ribus-tecnologia.cloudfunctions.net/api/relay",
    sign: "https://us-central1-ribus-tecnologia.cloudfunctions.net/api/sign",
    // transfer: "http://localhost:5001/ribus-tecnologia/us-central1/api/transfer",
    transfer:
      "https://us-central1-ribus-tecnologia.cloudfunctions.net/api/transfer",
  },
};

export const toChainId = (inc: number | string) => "0x" + (+inc).toString(16);

export const iconString = `
<?xml version="1.0" encoding="utf-8"?>
<svg viewBox="60 408.121 31.88 31.879" width="31.88" height="31.879" xmlns="http://www.w3.org/2000/svg">
  <linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="139.84" y1="106.089" x2="295.754" y2="106.089" gradientTransform="matrix(1, 0, 0, 1, 48.4828, 29.706137)">
    <stop offset="0" stop-color="#f3712b" stop-opacity="0"/>
    <stop offset="0.997" stop-color="#f47b2b"/>
  </linearGradient>
  <linearGradient id="SVGID_2_" gradientUnits="userSpaceOnUse" x1="131.157" y1="171.356" x2="302.583" y2="171.356" gradientTransform="matrix(1, 0, 0, 1, 48.4828, 29.706137)">
    <stop offset="0" stop-color="#f3712b" stop-opacity="0"/>
    <stop offset="0.997" stop-color="#f47b2b"/>
  </linearGradient>
  <linearGradient id="SVGID_3_" gradientUnits="userSpaceOnUse" x1="121.849" y1="236.995" x2="309.304" y2="236.995" gradientTransform="matrix(1, 0, 0, 1, 48.4828, 29.706137)">
    <stop offset="0" stop-color="#f3712b" stop-opacity="0"/>
    <stop offset="0.997" stop-color="#f47b2b"/>
  </linearGradient>
  <linearGradient id="SVGID_4_" gradientUnits="userSpaceOnUse" x1="117.019" y1="289.233" x2="318.858" y2="289.233" gradientTransform="matrix(1, 0, 0, 1, 48.4828, 29.706137)">
    <stop offset="0" stop-color="#f3712b" stop-opacity="0"/>
    <stop offset="0.997" stop-color="#f47b2b"/>
  </linearGradient>
  <path class="st1" d="M 60 408.121 L 91.88 408.121 L 91.88 440 L 60 440 L 60 408.121 Z" style="fill: rgb(7, 47, 76);"/>
  <g transform="matrix(0.083893, 0, 0, 0.083893, 52.508507, 406.026855)" style="">
    <path class="st2" d="M 312.402 138.666 C 261.912 138.666 221.022 148.246 193.402 168.016 C 191.962 169.046 190.622 170.186 189.322 171.386 L 188.312 172.326 C 192.812 141.126 209.292 118.026 237.192 109.696 C 259.392 103.066 285.052 99.276 312.392 99.276 L 339.602 99.276 L 339.712 100.576 L 344.222 140.996 C 334.332 139.916 322.892 138.666 312.402 138.666 Z" style="fill: url(#SVGID_1_);"/>
    <path class="st3" d="M 312.402 200.426 C 255.542 200.426 205.952 216.786 179.632 241.096 L 179.632 240.806 C 182.242 209.496 202.712 182.656 232.042 173.076 C 255.382 165.446 282.912 161.036 312.392 161.036 C 324.212 161.036 335.632 162.026 346.702 163.356 L 351.052 202.656 C 339.002 201.006 325.412 200.426 312.402 200.426 Z" style="fill: url(#SVGID_2_);"/>
    <path class="st4" d="M 170.332 311.906 L 171.122 305.766 C 173.512 277.076 193.422 257.196 217.802 242.686 C 253.432 221.486 287.832 221.146 312.402 221.586 C 326.852 221.846 340.192 223.316 353.452 225.296 L 357.782 264.546 C 343.552 262.226 328.072 260.986 312.402 260.986 C 284.582 260.986 258.512 264.916 236.052 271.766 C 219.382 276.836 204.682 283.536 192.762 291.466 C 184.242 297.086 175.742 305.206 170.332 311.906 Z" style="fill: url(#SVGID_3_);"/>
    <path class="st5" d="M 367.342 349.656 L 165.502 349.656 C 165.502 349.546 165.502 349.416 165.522 349.296 C 165.572 348.386 165.682 347.286 165.922 346.046 C 165.942 346.006 165.942 345.976 165.942 345.936 C 167.972 335.446 177.892 314.766 223.072 300.386 C 249.352 292.006 280.002 288.216 312.412 288.216 C 329.712 288.216 345.092 289.746 360.972 292.126 L 367.342 349.656 Z" style="fill: url(#SVGID_4_);"/>
  </g>
</svg>
`;
