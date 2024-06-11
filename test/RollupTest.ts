import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MockL2 } from "./MockL2";
import { RollupExample, RollupExample__factory } from "../typechain-types";

describe("RollupExample", function () {
  let rollupExample: RollupExample;
  let admin: SignerWithAddress, alice: SignerWithAddress, bob: SignerWithAddress, charlie: SignerWithAddress;
  let l2: MockL2;

  before(async function () {
    [admin, alice, bob, charlie] = await ethers.getSigners();

    rollupExample = await ethers.deployContract("RollupExample");
    await rollupExample.waitForDeployment();

    l2 = new MockL2(await rollupExample.getAddress(), admin);
  });

  it("should set initial balances", async function () {
    // TODO: Implement test case for setting initial balances
  });

  it("should process L2 transactions and update balances", async function () {
    // TODO: Implement test case for processing L2 transactions and updating balances
  });

  it("should withdraw more than 1 ethers from alice to charlie", async function () {
    // TODO: Implement test case for withdrawing more than 1 ether
  });
});
