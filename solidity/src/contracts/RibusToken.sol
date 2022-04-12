// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract RibusToken is ERC20, Ownable, Initializable {
    using SafeMath for uint256;
    uint256 public supply = 3e8;

    constructor(address owner) ERC20("Ribus Token", "RBS") {
        transferOwnership(owner);
    }

    function init(address[] memory wallets, uint256[] memory percentages)
        public
        initializer
        onlyOwner
    {
        uint256 percentageSum = 0;
        for (uint256 i = 0; i < percentages.length; i++) {
            percentageSum += percentages[i];
        }
        require(
            wallets.length == percentages.length && percentageSum == 100,
            "Invalid input"
        );
        distributeTokens(wallets, percentages);
    }

    function distributeTokens(
        address[] memory wallets,
        uint256[] memory percentages
    ) internal onlyOwner onlyInitializing {
        for (uint256 i = 0; i < wallets.length; i++) {
            address wallet = wallets[i];
            uint256 percentage = percentages[i];
            require(
                wallet != address(0) && percentage != 0,
                "Invalid item input"
            );
            uint256 tokensDue = supply.mul(percentage).div(100);
            _mint(wallet, tokensDue);
        }
    }
}
