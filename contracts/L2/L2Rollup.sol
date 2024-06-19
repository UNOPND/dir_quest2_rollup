// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../MerkleProof.sol";
import "../L1/L1Rollup.sol";

contract L2Rollup {
    struct AccountState {
        address addr;
        uint256 nonce;
        uint256 balance;
    }

    struct Transaction {
        address from;
        address to;
        uint256 amount;
        uint256 nonce;
    }

    mapping(address => AccountState) public accounts;
    Transaction[] public transactions;

    L1Rollup public l1Rollup;
    bytes32 public currentBlockMerkleRoot;
    bytes32 public currentStateMerkleRoot;

    event TransactionSubmitted(address from, address to, uint256 amount, uint256 nonce);
    event StateProposed(bytes32 blockMerkleRoot, bytes32 stateMerkleRoot);

    constructor(address _l1Rollup, address[] memory initialAccounts, uint256[] memory initialBalances) {
        require(initialAccounts.length == initialBalances.length, "Accounts and balances length mismatch");

        l1Rollup = L1Rollup(_l1Rollup);

        for (uint256 i = 0; i < initialAccounts.length; i++) {
            accounts[initialAccounts[i]] = AccountState({
                addr: initialAccounts[i],
                nonce: 0,
                balance: initialBalances[i]
            });
        }
    }

    function submitTransaction(address _to, uint256 _amount) external {
        AccountState storage sender = accounts[msg.sender];
        require(sender.balance >= _amount, "Insufficient balance");
        require(sender.nonce == transactions.length, "Invalid nonce");

        Transaction memory tx_ = Transaction({
            from: msg.sender,
            to: _to,
            amount: _amount,
            nonce: sender.nonce
        });

        transactions.push(tx_);
        emit TransactionSubmitted(msg.sender, _to, _amount, sender.nonce);
    }

    function proposeRollup() external {
        require(transactions.length > 0, "No transactions to propose");

        bytes32 blockMerkleRoot = calculateTransactionMerkleRoot(transactions);
        for (uint256 i = 0; i < transactions.length; i++) {
            Transaction memory tx_ = transactions[i];
            AccountState storage sender = accounts[tx_.from];
            AccountState storage receiver = accounts[tx_.to];

            sender.balance -= tx_.amount;
            sender.nonce++;

            receiver.balance += tx_.amount;
        }

        bytes32[] memory stateHashes = new bytes32[](transactions.length);
        uint256 index = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            Transaction memory tx_ = transactions[i];
            uint256 j = index++;
            stateHashes[j] = keccak256(abi.encodePacked(accounts[tx_.from].addr, accounts[tx_.from].nonce, accounts[tx_.from].balance));
            stateHashes[j] = keccak256(abi.encodePacked(accounts[tx_.to].addr, accounts[tx_.to].nonce, accounts[tx_.to].balance));
        }

        bytes32 stateMerkleRoot = MerkleProof.calculateMerkleRoot(stateHashes);

        // Propose the new state to the L1 Rollup contract
        l1Rollup.proposeState(blockMerkleRoot, stateMerkleRoot);

        // Update the current Merkle roots
        currentBlockMerkleRoot = blockMerkleRoot;
        currentStateMerkleRoot = stateMerkleRoot;

        // Clear the transactions
        delete transactions;

        emit StateProposed(blockMerkleRoot, stateMerkleRoot);
    }

    function calculateTransactionMerkleRoot(Transaction[] memory _transactions) internal pure returns (bytes32) {
        if (_transactions.length == 0) {
            return bytes32(0);
        }
        bytes32[] memory hashes = new bytes32[](_transactions.length);
        for (uint256 i = 0; i < _transactions.length; i++) {
            hashes[i] = keccak256(abi.encodePacked(_transactions[i].from, _transactions[i].to, _transactions[i].amount, _transactions[i].nonce));
        }
        return MerkleProof.calculateMerkleRoot(hashes);
    }
}
