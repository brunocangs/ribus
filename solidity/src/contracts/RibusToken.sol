// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

contract RibusToken is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ERC2771ContextUpgradeable,
    PausableUpgradeable
{
    using SafeMathUpgradeable for uint256;
    uint256 private supply;
    bool public hasMinted;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address forwarder) ERC2771ContextUpgradeable(forwarder) {}

    function initialize() public initializer {
        __ERC20_init("RibusToken", "RIB");
        __ERC20Burnable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        //   300 000 000
        uint256 initialSupply = 3e8;
        // Adjust for decimal
        supply = initialSupply.mul(10**decimals());
        hasMinted = false;
    }

    function decimals() public pure virtual override returns (uint8) {
        return 8;
    }

    modifier firstMint() {
        require(!hasMinted);
        _;
    }

    function distribute(address[] memory wallets, uint256[] memory percentages)
        public
        onlyOwner
        firstMint
    {
        uint256 percentageSum = 0;
        for (uint256 i = 0; i < percentages.length; i++) {
            require(percentages[i] <= 100, "Invalid input");
            percentageSum = percentageSum.add(percentages[i]);
        }
        require(
            wallets.length == percentages.length && percentageSum == 100,
            "Invalid input"
        );
        distributeTokens(wallets, percentages);
        hasMinted = true;
    }

    function distributeTokens(
        address[] memory wallets,
        uint256[] memory percentages
    ) internal onlyOwner firstMint {
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

    function version() public pure virtual returns (string memory) {
        return "1.0.0";
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        virtual
        override
        onlyOwner
    {}

    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (address sender)
    {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (bytes calldata)
    {
        return ERC2771ContextUpgradeable._msgData();
    }
}
