// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RollupExample {
    mapping(bytes32 => bool) public processedTxs;
    bytes32[] public proposedMerkleRoots;
    bytes32[] public finalizedMerkleRoots;

    function proposeRollup(bytes32[] memory _leaves) public {
        // TODO : calculate merkle root on-chain
    }

    function finalizeRollup(
        bytes32 _merkleRoot,
        address[] memory _froms,
        address[] memory _tos,
        uint256[] memory _amounts,
        uint256[] memory _nonces
    ) public {
        // TODO : verify merkle root on-chain
    }

    function getMerkleRoot(
        bytes32[] memory _leaves
    ) public pure returns (bytes32) {
        // TODO : calculate merkle root on-chain
    }

    function isMerkleRootProposed(
        bytes32 _merkleRoot
    ) public view returns (bool) {}

    function isTransactionProcessed(
        address _from,
        address _to,
        uint256 _amount,
        uint256 _nonce
    ) public view returns (bool) {}
}
