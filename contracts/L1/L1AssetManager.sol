// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IL2AssetManager {
    function mint(address _user, uint256 _amount) external;
    function burn(address _user, uint256 _amount) external;
}

contract L1AssetManager is Ownable {
    event Deposit(address indexed user, uint256 amount);
    event Mint(address indexed user, uint256 amount);
    event WithdrawRequested(address indexed user, uint256 amount, uint256 unlockTime);
    event Withdraw(address indexed user, uint256 amount);

    struct PendingWithdraw {
        uint256 amount;
        uint256 unlockTime;
    }

    mapping(address => uint256) public deposits;
    mapping(address => PendingWithdraw) public pendingWithdraws;

    address public l2AssetManager;
    uint256 public pendingPeriod;

    constructor(uint256 _pendingPeriod, address initialOwner) Ownable(initialOwner) {
        pendingPeriod = _pendingPeriod;
    }

    function setL2AssetManager(address _l2AssetManager) external onlyOwner {
        l2AssetManager = _l2AssetManager;
    }

    function deposit() external payable {
        require(msg.value > 0, "Must send ETH to deposit");

        deposits[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function mint(uint256 _amount) external {
        require(deposits[msg.sender] >= _amount, "Insufficient balance");

        deposits[msg.sender] -= _amount;
        IL2AssetManager(l2AssetManager).mint(msg.sender, _amount);
        emit Mint(msg.sender, _amount);
    }

    function requestWithdraw(uint256 _amount) external {
        require(deposits[msg.sender] >= _amount, "Insufficient balance");

        uint256 unlockTime = block.timestamp + pendingPeriod;
        pendingWithdraws[msg.sender] = PendingWithdraw({
            amount: _amount,
            unlockTime: unlockTime
        });

        emit WithdrawRequested(msg.sender, _amount, unlockTime);
    }

    function withdraw() external {
        PendingWithdraw storage pendingWithdraw = pendingWithdraws[msg.sender];
        require(pendingWithdraw.amount > 0, "No pending withdrawal");
        require(block.timestamp >= pendingWithdraw.unlockTime, "Withdrawal is still locked");

        uint256 amount = pendingWithdraw.amount;
        deposits[msg.sender] -= amount;
        delete pendingWithdraws[msg.sender];

        payable(msg.sender).transfer(amount);
        emit Withdraw(msg.sender, amount);
    }

    function setPendingPeriod(uint256 _pendingPeriod) external onlyOwner {
        pendingPeriod = _pendingPeriod;
    }

    function depositFromL2(address _user, uint256 _amount) external {
        require(msg.sender == l2AssetManager, "Only L2AssetManager can call this function");
        deposits[_user] += _amount;
    }
}