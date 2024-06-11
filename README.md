# Sample Rollup project

using node 18

```shell
yarn hardhat test
```

## Rollup Example

This project demonstrates a simplified example of a rollup system on Ethereum. 
It consists of an L1 contract (RollupExample) and an L2 class (MockL2) that interact with each other to process transactions and update balances.

## Overview
In this example, we assume a special case of L2 where transactions are not actually executed until a block is finalized on L1. The L2 class (MockL2) handles the following:

1. Adding transactions to a pending queue.
2. Proposing a batch of transactions to L1 by calculating the Merkle root.
3. Finalizing the proposed transactions on L1 and updating the balances on L2.

The L1 contract (RollupExample) is responsible for:

1. Receiving proposed Merkle roots from L2.
2. Finalizing the proposed transactions and verifying the Merkle proofs.
3. Keeping track of processed transactions.
