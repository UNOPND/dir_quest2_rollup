// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RollupExample {
    mapping(bytes32 => bool) public processedTxs;
    bytes32[] public proposedMerkleRoots;
    bytes32[] public finalizedMerkleRoots;

    function proposeRollup(bytes32[] memory _leaves) public {
        bytes32 merkleRoot = getMerkleRoot(_leaves);
        proposedMerkleRoots.push(merkleRoot);
    }

    function finalizeRollup(
        bytes32 _merkleRoot,
        address[] memory _froms,
        address[] memory _tos,
        uint256[] memory _amounts,
        uint256[] memory _nonces
    ) public {
        require(isMerkleRootProposed(_merkleRoot), "Merkle root is not proposed");

        uint256 numTransactions = _froms.length;
        require(numTransactions == _tos.length, "Arrays must have the same length");
        require(numTransactions == _amounts.length, "Arrays must have the same length");
        require(numTransactions == _nonces.length, "Arrays must have the same length");

        bytes32[] memory leaves = new bytes32[](numTransactions);
        for (uint256 i = 0; i < numTransactions; i++) {
            leaves[i] = encodeTransaction(_froms[i], _tos[i], _amounts[i], _nonces[i]);
        }

        bytes32 calculatedRoot = getMerkleRoot(leaves);
        require(calculatedRoot == _merkleRoot, "Merkle root does not match");

        for (uint256 i = 0; i < numTransactions; i++) {
            bytes32 txHash = leaves[i];
            require(!processedTxs[txHash], "Transaction already processed");
            processedTxs[txHash] = true;
        }

        finalizedMerkleRoots.push(_merkleRoot);
    }

    function getMerkleRoot(
        bytes32[] memory _leaves
    ) public pure returns (bytes32) {
        require(_leaves.length > 0, "Leaves are empty");

        while (_leaves.length > 1) {
            uint256 length = _leaves.length;
            uint256 newLength = (length + 1) / 2;
            bytes32[] memory newLeaves = new bytes32[](newLength);

            for (uint256 i = 0; i < length / 2; i++) {
                newLeaves[i] = keccak256(abi.encodePacked(_leaves[2 * i], _leaves[2 * i + 1]));
            }
            if (length % 2 == 1) {
                newLeaves[newLength - 1] = keccak256(abi.encodePacked(_leaves[length - 1], _leaves[length - 1]));
            }
            _leaves = newLeaves;
        }

        return _leaves[0];
    }

    function isMerkleRootProposed(
        bytes32 _merkleRoot
    ) public view returns (bool) {
        for (uint256 i = 0; i < proposedMerkleRoots.length; i++) {
            if (proposedMerkleRoots[i] == _merkleRoot) {
                return true;
            }
        }
        return false;
    }

    function isTransactionProcessed(
        address _from,
        address _to,
        uint256 _amount,
        uint256 _nonce
    ) public view returns (bool) {
        bytes32 txHash = encodeTransaction(_from, _to, _amount, _nonce);
        return processedTxs[txHash];
    }

    function encodeTransaction(
        address _from,
        address _to,
        uint256 _amount,
        uint256 _nonce
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_from, _to, _amount, _nonce));
    }
}
