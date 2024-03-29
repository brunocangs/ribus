/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type {
  ERC2771ContextUpgradeable,
  ERC2771ContextUpgradeableInterface,
} from "../ERC2771ContextUpgradeable";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "version",
        type: "uint8",
      },
    ],
    name: "Initialized",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "forwarder",
        type: "address",
      },
    ],
    name: "isTrustedForwarder",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export class ERC2771ContextUpgradeable__factory {
  static readonly abi = _abi;
  static createInterface(): ERC2771ContextUpgradeableInterface {
    return new utils.Interface(_abi) as ERC2771ContextUpgradeableInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ERC2771ContextUpgradeable {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as ERC2771ContextUpgradeable;
  }
}
