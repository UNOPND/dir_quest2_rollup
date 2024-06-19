// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../MerkleProof.sol";

contract L1Rollup {

    struct Rollup {
        bytes32 blockMerkleRoot;
        bytes32 stateMerkleRoot;
        uint256 timestamp; // Time when the state was proposed
    }

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

    Rollup[] public proposed;
    Rollup[] public finalized;

    uint256 public finalizationPeriod; // Time period required before a state can be finalized

    event RollupProposed(uint256 index, bytes32 blockMerkleRoot, bytes32 stateMerkleRoot, uint256 timestamp);
    event RollupFinalized(uint256 index, bytes32 blockMerkleRoot, bytes32 stateMerkleRoot);
    event RollupInvalidated(uint256 index, bytes32 blockMerkleRoot, bytes32 stateMerkleRoot);

    constructor(uint256 _finalizationPeriod, bytes32 _initialBlockMerkleRoot, bytes32 _initialStateMerkleRoot) {
        finalizationPeriod = _finalizationPeriod;
        Rollup memory initialRollup = Rollup({
            blockMerkleRoot: _initialBlockMerkleRoot,
            stateMerkleRoot: _initialStateMerkleRoot,
            timestamp: block.timestamp
        });
        finalized.push(initialRollup);
    }

    function proposeState(bytes32 _blockMerkleRoot, bytes32 _stateMerkleRoot) external {
        Rollup memory rollup = Rollup({
            blockMerkleRoot: _blockMerkleRoot,
            stateMerkleRoot: _stateMerkleRoot,
            timestamp: block.timestamp
        });

        proposed.push(rollup);
        emit RollupProposed(proposed.length - 1, _blockMerkleRoot, _stateMerkleRoot, block.timestamp);
    }

    function finalizeState(uint256 _index) external {
        require(_index < proposed.length, "Invalid index");

        Rollup memory stateToFinalize = proposed[_index];
        require(block.timestamp >= stateToFinalize.timestamp + finalizationPeriod, "Finalization period not met");

        finalized.push(stateToFinalize);

        // Remove the state from proposed
        for (uint256 i = _index; i < proposed.length - 1; i++) {
            proposed[i] = proposed[i + 1];
        }
        proposed.pop();

        emit RollupFinalized(finalized.length - 1, stateToFinalize.blockMerkleRoot, stateToFinalize.stateMerkleRoot);
    }

    function submitFraudProof(
        uint256 _index,
        AccountState memory _initialState,
        bytes32[] memory _stateProof,
        Transaction[] memory _txs,
        AccountState memory _afterState,
        bytes32[] memory _finalStateProof
    ) external {
        Rollup memory proposedRollup = proposed[_index];
        Rollup memory lastFinalizedRollup = finalized[finalized.length - 1];

        // 1. Verify the initial account state proof
        bytes32 initialStateHash = keccak256(abi.encodePacked(_initialState.addr, _initialState.nonce, _initialState.balance));
        require(MerkleProof.verify(_stateProof, lastFinalizedRollup.stateMerkleRoot, initialStateHash), "Invalid initial account state proof");

        // 2. Calculate the Merkle root of _txs and compare it to the proposed block Merkle root
        bytes32 computedTxsRoot = calculateTransactionMerkleRoot(_txs);
        require(computedTxsRoot == proposedRollup.blockMerkleRoot, "Block Merkle root does not match");

        // 3. Verify the after state proof
        bytes32 afterStateHash = keccak256(abi.encodePacked(_afterState.addr, _afterState.nonce, _afterState.balance));
        require(MerkleProof.verify(_finalStateProof, proposedRollup.stateMerkleRoot, afterStateHash), "Invalid after state proof");

        // 4. Replay transactions
        AccountState memory currentState = _initialState;
        for (uint256 i = 0; i < _txs.length; i++) {
            Transaction memory _tx = _txs[i];

            // Check if transaction nonce and balance are valid for outgoing transactions
            if (currentState.addr == _tx.from) {
                if (currentState.nonce != _tx.nonce || currentState.balance < _tx.amount) {
                    invalidateProposedState(_index);
                    return;
                }
                currentState.nonce += 1;
                currentState.balance -= _tx.amount;
            }

            // Process incoming transactions
            if (currentState.addr == _tx.to) {
                currentState.balance += _tx.amount;
            }
        }

        // 5. Ensure the computed final state matches the provided after state
        if (
            keccak256(abi.encodePacked(currentState.addr, currentState.nonce, currentState.balance)) !=
            keccak256(abi.encodePacked(_afterState.addr, _afterState.nonce, _afterState.balance))
        ) {
            invalidateProposedState(_index);
        } else {
            revert("Invalidation failed: resulting state is valid");
        }
    }

    function calculateTransactionMerkleRoot(Transaction[] memory transactions) internal pure returns (bytes32) {
        if (transactions.length == 0) {
            return bytes32(0);
        }
        bytes32[] memory hashes = new bytes32[](transactions.length);
        for (uint256 i = 0; i < transactions.length; i++) {
            hashes[i] = keccak256(abi.encodePacked(transactions[i].from, transactions[i].to, transactions[i].amount, transactions[i].nonce));
        }
        return MerkleProof.calculateMerkleRoot(hashes);
    }

    function invalidateProposedState(uint256 _index) internal {
        Rollup memory rollupToInvalidate = proposed[_index];

        // Remove the state from proposed
        for (uint256 i = _index; i < proposed.length - 1; i++) {
            proposed[i] = proposed[i + 1];
        }
        proposed.pop();

        emit RollupInvalidated(_index, rollupToInvalidate.blockMerkleRoot, rollupToInvalidate.stateMerkleRoot);
    }
}
