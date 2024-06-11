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
    this.rollupExample = RollupExample__factory.connect(rollupExampleAddress, signer);
    this.isTxsProposed = false;
  }

  public setInitialBalance(addresses: string[]) {
    // TODO: Implement logic to set initial balances
  }

  public async addTransaction(from: string, to: string, amount: bigint) {
    // TODO: Implement logic to add a transaction to the pending queue
    // console.log(`Transaction added with nonce`);
  }

  public async proposeTransactions() {
    // TODO: Implement logic to calculate Merkle root and call proposeRollup
  }

  public async finalizeTransactions() {
    // TODO: Implement logic to calculate Merkle root, call finalizeRollup, and update balances
  }

  public async isTransactionProcessed(from: string, to: string, amount: bigint, nonce: bigint): Promise<boolean> {
    // TODO: Implement logic to check if a transaction has been processed
  }

  public getBalance(address: string): bigint {
    return this.balances[address] || 0n;
  }
}
