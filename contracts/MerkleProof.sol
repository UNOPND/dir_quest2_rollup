// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library MerkleProof {
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {        
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                // Hash(current computed hash + current element of the proof)
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                // Hash(current element of the proof + current computed hash)
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        // Check if the computed hash (root) is equal to the provided root
        return computedHash == root;
    }

    function calculateMerkleRoot(bytes32[] memory leaves) internal pure returns (bytes32) {
        if (leaves.length == 0) {
            return bytes32(0);
        }
        while (leaves.length > 1) {
            uint256 length = leaves.length;
            uint256 newLength = (length + 1) / 2;
            bytes32[] memory newLeaves = new bytes32[](newLength);

            for (uint256 i = 0; i < length / 2; i++) {
                newLeaves[i] = keccak256(abi.encodePacked(leaves[2 * i], leaves[2 * i + 1]));
            }
            if (length % 2 == 1) {
                newLeaves[newLength - 1] = keccak256(abi.encodePacked(leaves[length - 1], leaves[length - 1]));
            }
            leaves = newLeaves;
        }
        return leaves[0];
    }
}
