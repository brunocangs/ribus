// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./RibusToken.sol";

contract RibusTokenV2 is RibusToken {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address forwarder) RibusToken(forwarder) {}

    function version() public pure virtual override returns (string memory) {
        return "2.0.0";
    }
}
