import { expect } from "chai";
import { ethers } from "hardhat";
import { RollupExample, RollupExample__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

function encodeTransaction(
  from: string,
  to: string,
  amount: number,
  nonce: number
): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      ["address", "address", "uint256", "uint256"],
      [from, to, amount, nonce]
    )
  );
}

function getMerkleRoot(leaves: string[]): string {
  while (leaves.length > 1) {
    const newLeaves: string[] = [];
    for (let i = 0; i < Math.floor(leaves.length / 2); i++) {
      newLeaves.push(
        ethers.keccak256(leaves[2 * i] + leaves[2 * i + 1].slice(2))
      );
    }
    if (leaves.length % 2 === 1) {
      newLeaves.push(
        ethers.keccak256(
          leaves[leaves.length - 1] + leaves[leaves.length - 1].slice(2)
        )
      );
    }
    leaves = newLeaves;
  }
  return leaves[0];
}

describe("RollupExample", function () {
  let rollup: RollupExample;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;

  beforeEach(async function () {
    rollup = await ethers.deployContract("RollupExample");
    [owner, addr1, addr2] = await ethers.getSigners();
    await rollup.waitForDeployment();
  });

  describe("getMerkleRoot", function () {
    it("Should calculate the correct merkle root", async function () {
      const leaves = [
        encodeTransaction(addr1.address, addr2.address, 100, 1),
        encodeTransaction(addr2.address, addr1.address, 50, 2),
        encodeTransaction(addr1.address, addr2.address, 100, 1),
        encodeTransaction(addr2.address, addr1.address, 50, 2),
        encodeTransaction(addr1.address, addr2.address, 100, 1),
      ];

      const tsMerkleRoot = getMerkleRoot(leaves);
      const solidityMerkleRoot = await rollup.getMerkleRoot(leaves);

      expect(solidityMerkleRoot).to.equal(tsMerkleRoot);
    });
  });

  describe("isMerkleRootProposed", function () {
    it("Should return true for proposed merkle root", async function () {
      const leaves = [
        encodeTransaction(addr1.address, addr2.address, 100, 1),
        encodeTransaction(addr2.address, addr1.address, 50, 2),
      ];

      await rollup.proposeRollup(leaves);

      const tsMerkleRoot = getMerkleRoot(leaves);
      const isProposed = await rollup.isMerkleRootProposed(tsMerkleRoot);

      expect(isProposed).to.equal(true);
    });

    it("Should return false for non-proposed merkle root", async function () {
      const fakeMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("root"));
      const isProposed = await rollup.isMerkleRootProposed(fakeMerkleRoot);

      expect(isProposed).to.equal(false);
    });
  });

  describe("finalizeRollup", function () {
    it("Should finalize a rollup with a valid merkle root", async function () {
      const leaves = [
        encodeTransaction(addr1.address, addr2.address, 100, 1),
        encodeTransaction(addr2.address, addr1.address, 50, 2),
      ];

      await rollup.proposeRollup(leaves);

      const proposedMerkleRoots = await rollup.proposedMerkleRoots(0);
      const tsMerkleRoot = getMerkleRoot(leaves);

      const froms = [addr1.address, addr2.address];
      const tos = [addr2.address, addr1.address];
      const amounts = [100, 50];
      const nonces = [1, 2];

      await rollup.finalizeRollup(tsMerkleRoot, froms, tos, amounts, nonces);

      const finalizedMerkleRoots = await rollup.finalizedMerkleRoots(0);
      expect(finalizedMerkleRoots).to.equal(proposedMerkleRoots);

      for (let i = 0; i < froms.length; i++) {
        const txHash = encodeTransaction(
          froms[i],
          tos[i],
          amounts[i],
          nonces[i]
        );
        const isProcessed = await rollup.processedTxs(txHash);
        expect(isProcessed).to.equal(true);
      }
    });
  });
});
