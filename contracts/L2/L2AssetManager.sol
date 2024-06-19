// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./WETH.sol";

interface IL1AssetManager {
    function depositFromL2(address _user, uint256 _amount) external;
}

contract L2AssetManager is Ownable {
    WrappedETH public wrappedETH;
    address public l1AssetManager;

    constructor(address _wrappedETH, address _l1AssetManager, address initialOwner) Ownable(initialOwner){
        wrappedETH = WrappedETH(_wrappedETH);
        l1AssetManager = _l1AssetManager;
    }

    modifier onlyL1AssetManager() {
        require(msg.sender == l1AssetManager, "Only L1AssetManager contract can call this function");
        _;
    }

    function mint(address _user, uint256 _amount) external onlyL1AssetManager {
        wrappedETH.mint(_user, _amount);
    }

    function burn(address _user, uint256 _amount) external onlyL1AssetManager {
        wrappedETH.burn(_user, _amount);
    }

    function deposit(uint256 _amount) external {
        require(wrappedETH.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        IL1AssetManager(l1AssetManager).depositFromL2(msg.sender, _amount);
    }
}
