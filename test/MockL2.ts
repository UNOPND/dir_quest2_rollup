import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { RollupExample, RollupExample__factory } from "../typechain-types";

export class MockL2 {
  private rollupExample: RollupExample;
  private pendingTxs: any[] = [];
  private isTxsProposed: boolean;
  private nonces: { [address: string]: bigint } = {};
  private balances: { [address: string]: bigint } = {};

  constructor(rollupExampleAddress: string, signer: SignerWithAddress) {
    this.rollupExample = RollupExample__factory.connect(
      rollupExampleAddress,
      signer
    );
    this.isTxsProposed = false;
  }

  public setInitialBalance(addresses: string[]) {
    for (const address of addresses) {
      this.balances[address] = ethers.parseEther("10");
    }
  }

  public async addTransaction(from: string, to: string, amount: bigint) {
    if (!(this.balances[from] && this.balances[from] >= amount)) {
      throw new Error("Insufficient balance");
    }

    const nonce = this.nonces[from] ?? 0n;
    this.pendingTxs.push({ from, to, amount, nonce });
    this.nonces[from] = nonce + 1n;
    console.log(
      `Transaction added: from ${from} to ${to} with amount ${amount} and nonce ${nonce}`
    );
  }

  public async proposeTransactions() {
    if (this.pendingTxs.length === 0) {
      console.log("Empty transactions");
      return;
    }

    const leaves = this.pendingTxs.map((tx) =>
      this.encodeTransaction(tx.from, tx.to, tx.amount, tx.nonce)
    );

    await this.rollupExample.proposeRollup(leaves);
    this.isTxsProposed = true;
  }

  public async finalizeTransactions() {
    if (!this.isTxsProposed) {
      throw new Error("Transactions have not been proposed yet");
    }

    if (this.pendingTxs.length === 0) {
      throw new Error("No transactions to finalize");
    }

    const froms = this.pendingTxs.map((tx) => tx.from);
    const tos = this.pendingTxs.map((tx) => tx.to);
    const amounts = this.pendingTxs.map((tx) => tx.amount);
    const nonces = this.pendingTxs.map((tx) => tx.nonce);

    const leaves = this.pendingTxs.map((tx) =>
      this.encodeTransaction(tx.from, tx.to, tx.amount, tx.nonce)
    );

    const merkleRoot = this.getMerkleRoot(leaves);

    await this.rollupExample.finalizeRollup(
      merkleRoot,
      froms,
      tos,
      amounts,
      nonces
    );

    for (const tx of this.pendingTxs) {
      this.balances[tx.from] -= tx.amount;
      this.balances[tx.to] = (this.balances[tx.to] ?? 0n) + tx.amount;
    }

    this.pendingTxs = [];
    this.isTxsProposed = false;
  }

  public async isTransactionProcessed(
    from: string,
    to: string,
    amount: bigint,
    nonce: bigint
  ): Promise<boolean> {
    const response = await this.rollupExample.isTransactionProcessed(
      from,
      to,
      amount,
      nonce
    );
    return response.valueOf();
  }

  public getBalance(address: string): bigint {
    return this.balances[address] || 0n;
  }

  private getMerkleRoot(leaves: string[]): string {
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

  private encodeTransaction(
    from: string,
    to: string,
    amount: bigint,
    nonce: bigint
  ): string {
    return ethers.keccak256(
      ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [from, to, amount, nonce]
      )
    );
  }
}
