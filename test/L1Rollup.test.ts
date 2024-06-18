import { expect } from "chai";
import { ethers } from "hardhat";
import { L1Rollup, L1Rollup__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  generateBlockMerkleRoot,
  generateMerkleProof,
  generateStateMerkleRoot,
} from "./helper";

describe("L1Rollup", async function () {
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let l1Rollup: L1Rollup;
  const finalizationPeriod = 60 * 60 * 24; // 1 day in seconds

  beforeEach(async function () {
    [deployer, user] = await ethers.getSigners();

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

    // Deploy L1Rollup contract with initial state
    const L1RollupFactory = (await ethers.getContractFactory(
      "L1Rollup"
    )) as L1Rollup__factory;
    l1Rollup = await L1RollupFactory.deploy(
      finalizationPeriod,
      initialBlockMerkleRoot,
      initialStateMerkleRoot
    );
  });

  it("should propose a new state", async function () {
    const blockMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("blockRoot"));
    const stateMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("stateRoot"));

    await l1Rollup.proposeState(blockMerkleRoot, stateMerkleRoot);

    const proposedState = await l1Rollup.proposed(0);
    expect(proposedState.blockMerkleRoot).to.equal(blockMerkleRoot);
    expect(proposedState.stateMerkleRoot).to.equal(stateMerkleRoot);
  });

  it("should finalize a proposed state after the finalization period", async function () {
    const blockMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("blockRoot"));
    const stateMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("stateRoot"));

    await l1Rollup.proposeState(blockMerkleRoot, stateMerkleRoot);

    // Fast forward time to after the finalization period
    await ethers.provider.send("evm_increaseTime", [finalizationPeriod + 1]);
    await ethers.provider.send("evm_mine", []);

    await l1Rollup.finalizeState(0);

    const finalizedState = await l1Rollup.finalized(1);
    expect(finalizedState.blockMerkleRoot).to.equal(blockMerkleRoot);
    expect(finalizedState.stateMerkleRoot).to.equal(stateMerkleRoot);
  });

  it("should finalize a valid proposed state", async function () {
    const tx = {
      from: user.address,
      to: ethers.ZeroAddress,
      amount: ethers.parseEther("1"),
      nonce: 0,
    };

    const afterState = [
      {
        addr: user.address,
        nonce: 1,
        balance: ethers.parseEther("0"),
      },
      {
        addr: deployer.address,
        nonce: 0,
        balance: ethers.parseEther("2"),
      },
    ];

    const stateMerkleRoot = generateStateMerkleRoot(afterState);
    const blockMerkleRoot = generateBlockMerkleRoot([tx]);

    await l1Rollup.connect(user).proposeState(blockMerkleRoot, stateMerkleRoot);

    // Fast forward time to after the finalization period
    await ethers.provider.send("evm_increaseTime", [finalizationPeriod + 1]);
    await ethers.provider.send("evm_mine", []);

    await l1Rollup.finalizeState(0);

    const finalizedState = await l1Rollup.finalized(1);
    expect(finalizedState.blockMerkleRoot).to.equal(blockMerkleRoot);
    expect(finalizedState.stateMerkleRoot).to.equal(stateMerkleRoot);
  });

  it("should reject invalid initial account state proof", async function () {
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

    const tx = {
      from: user.address,
      to: ethers.ZeroAddress,
      amount: ethers.parseEther("1"),
      nonce: 0,
    };

    const stateMerkleRoot = generateStateMerkleRoot(initialState);
    const blockMerkleRoot = generateBlockMerkleRoot([tx]);

    await l1Rollup.connect(user).proposeState(blockMerkleRoot, stateMerkleRoot);

    // Create fake invalid proofs
    const invalidProof = [ethers.keccak256(ethers.toUtf8Bytes("invalidProof"))];

    await expect(
      l1Rollup
        .connect(user)
        .submitFraudProof(
          0,
          initialState[0],
          invalidProof,
          [tx],
          initialState[0],
          invalidProof
        )
    ).to.be.revertedWith("Invalid initial account state proof");
  });

  it("should invalidate a proposed state with valid proof due to insufficient balance", async function () {
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

    const tx = {
      from: user.address,
      to: ethers.ZeroAddress,
      amount: ethers.parseEther("2"), // Invalid amount, more than balance
      nonce: 0,
    };

    const afterState = [
      {
        addr: user.address,
        nonce: 0,
        balance: ethers.parseEther("3"),
      },
      {
        addr: deployer.address,
        nonce: 0,
        balance: ethers.parseEther("2"),
      },
    ];

    const stateMerkleRoot = generateStateMerkleRoot(afterState);
    const blockMerkleRoot = generateBlockMerkleRoot([tx]);

    await l1Rollup.connect(user).proposeState(blockMerkleRoot, stateMerkleRoot);

    // Create valid proofs
    const initialStateHashes = initialState.map((state) =>
      ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256", "uint256"],
          [state.addr, state.nonce, state.balance]
        )
      )
    );

    const stateProof = generateMerkleProof(initialStateHashes, 0);

    await l1Rollup
      .connect(user)
      .submitFraudProof(
        0,
        initialState[0],
        stateProof,
        [tx],
        afterState[0],
        stateProof
      );

    expect(await l1Rollup.proposed.length).to.equal(0);
  });

  it("should invalidate a proposed state with valid proof resulting in invalid state", async function () {
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

    const tx1 = {
      from: user.address,
      to: ethers.ZeroAddress,
      amount: ethers.parseEther("1"),
      nonce: 0,
    };

    const afterState = [
      {
        addr: user.address,
        nonce: 1,
        balance: ethers.parseEther("0"),
      },
      {
        addr: deployer.address,
        nonce: 0,
        balance: ethers.parseEther("4"),
      },
    ];

    const stateMerkleRoot = generateStateMerkleRoot(afterState);
    const blockMerkleRoot = generateBlockMerkleRoot([tx1]);

    await l1Rollup.connect(user).proposeState(blockMerkleRoot, stateMerkleRoot);

    // Create valid proofs for the initial state
    const initialStateHashes = initialState.map((state) =>
      ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256", "uint256"],
          [state.addr, state.nonce, state.balance]
        )
      )
    );
    const initialStateProof = generateMerkleProof(initialStateHashes, 1);

    // Create valid proofs for the after state
    const afterStateHashes = afterState.map((state) =>
      ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256", "uint256"],
          [state.addr, state.nonce, state.balance]
        )
      )
    );

    const finalStateProof = generateMerkleProof(afterStateHashes, 1);

    // Invalidate state
    await l1Rollup
      .connect(user)
      .submitFraudProof(
        0,
        initialState[1],
        initialStateProof,
        [tx1],
        afterState[1],
        finalStateProof
      );

    // Ensure that the proposed state has been invalidated
    expect(await l1Rollup.proposed.length).to.equal(0);
  });
});
