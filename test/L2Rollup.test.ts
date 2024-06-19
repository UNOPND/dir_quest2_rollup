import { expect } from "chai";
import { ethers } from "hardhat";
import {
  L1Rollup,
  L1Rollup__factory,
  L2Rollup,
  L2Rollup__factory,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  generateBlockMerkleRoot,
  generateMerkleProof,
  generateStateMerkleRoot,
} from "./helper";

describe("L2Rollup", function () {
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let l1Rollup: L1Rollup;
  let l2Rollup: L2Rollup;
  const finalizationPeriod = 60 * 60 * 24; // 1 day in seconds

  beforeEach(async function () {
    // Deploy the L1Rollup contract
    [deployer, user, user2] = await ethers.getSigners();

    const initialState = [
      {
        addr: user.address,
        nonce: 0,
        balance: ethers.parseEther("1"),
      },
      {
        addr: deployer.address,
        nonce: 0,
        balance: ethers.parseEther("2"),
      },
    ];

    const initialTxs = [
      {
        from: ethers.ZeroAddress,
        to: user.address,
        amount: ethers.parseEther("1"),
        nonce: 0,
      },
      {
        from: ethers.ZeroAddress,
        to: deployer.address,
        amount: ethers.parseEther("2"),
        nonce: 0,
      },
    ];

    const initialStateMerkleRoot = generateStateMerkleRoot(initialState);
    const initialBlockMerkleRoot = generateBlockMerkleRoot(initialTxs);

    const L1RollupFactory = (await ethers.getContractFactory(
      "L1Rollup"
    )) as L1Rollup__factory;
    l1Rollup = await L1RollupFactory.deploy(
      finalizationPeriod,
      initialBlockMerkleRoot,
      initialStateMerkleRoot
    );

    const initialAccounts = [deployer.address, user.address, user2.address];
    const initialBalances = [
      ethers.parseEther("10"),
      ethers.parseEther("5"),
      ethers.parseEther("2"),
    ];

    const L2RollupFactory = (await ethers.getContractFactory(
      "L2Rollup"
    )) as L2Rollup__factory;
    l2Rollup = await L2RollupFactory.deploy(
      await l1Rollup.getAddress(),
      initialAccounts,
      initialBalances
    );
  });

  it("should submit a transaction and propose a state", async function () {
    // Submit a transaction from owner to addr1
    await l2Rollup
      .connect(user)
      .submitTransaction(user2.address, ethers.parseEther("1"));

    const tx = await l2Rollup.transactions(0);
    expect(tx.from).to.equal(user.address);
    expect(tx.to).to.equal(user2.address);
    expect(tx.amount).to.equal(ethers.parseEther("1"));

    // Propose the state
    await l2Rollup.proposeRollup();

    const currentBlockMerkleRoot = await l2Rollup.currentBlockMerkleRoot();
    const currentStateMerkleRoot = await l2Rollup.currentStateMerkleRoot();
    expect(currentBlockMerkleRoot).to.not.equal(ethers.ZeroHash);
    expect(currentStateMerkleRoot).to.not.equal(ethers.ZeroHash);
  });
});
