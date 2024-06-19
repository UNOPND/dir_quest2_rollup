import { expect } from "chai";
import { ethers } from "hardhat";
import {
  WrappedETH__factory,
  L1AssetManager__factory,
  L2AssetManager__factory,
  L1AssetManager,
  L2AssetManager,
  WrappedETH,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Rollup", function () {
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let wrappedETH: WrappedETH;
  let l1AssetManager: L1AssetManager;
  let l2AssetManager: L2AssetManager;
  const pendingPeriod = 60 * 60 * 24; // 1 day in seconds

  beforeEach(async function () {
    [deployer, user] = await ethers.getSigners();

    // Deploy WrappedETH contract
    const WrappedETHFactory = (await ethers.getContractFactory(
      "WrappedETH"
    )) as WrappedETH__factory;
    wrappedETH = await WrappedETHFactory.deploy();

    // Deploy L1AssetManager contract
    const L1AssetManagerFactory = (await ethers.getContractFactory(
      "L1AssetManager"
    )) as L1AssetManager__factory;
    l1AssetManager = await L1AssetManagerFactory.deploy(
      pendingPeriod,
      deployer.address
    );

    // Deploy L2AssetManager contract
    const L2AssetManagerFactory = (await ethers.getContractFactory(
      "L2AssetManager"
    )) as L2AssetManager__factory;
    l2AssetManager = await L2AssetManagerFactory.deploy(
      await wrappedETH.getAddress(),
      await l1AssetManager.getAddress(),
      deployer.address
    );

    await l1AssetManager.setL2AssetManager(await l2AssetManager.getAddress());

    // Grant roles to L2AssetManager
    const minterRole = await wrappedETH.MINTER_ROLE();
    const burnerRole = await wrappedETH.BURNER_ROLE();

    await wrappedETH
      .connect(deployer)
      .grantRole(minterRole, await l2AssetManager.getAddress());
    await wrappedETH
      .connect(deployer)
      .grantRole(burnerRole, await l2AssetManager.getAddress());
  });

  it("should allow a user to deposit ETH in L1, mint WETH in L2, and withdraw ETH back in L1", async function () {
    // User deposits 1 ETH in L1
    await l1AssetManager
      .connect(user)
      .deposit({ value: ethers.parseEther("1") });

    expect(
      await ethers.provider.getBalance(await l1AssetManager.getAddress())
    ).to.equal(ethers.parseEther("1"));

    // User mints 1 WETH in L2
    await l1AssetManager.connect(user).mint(ethers.parseEther("1"));
    expect(await wrappedETH.balanceOf(await user.getAddress())).to.equal(
      ethers.parseEther("1")
    );

    // User deposits 1 WETH in L2 to withdraw ETH in L1
    await wrappedETH
      .connect(user)
      .approve(await l2AssetManager.getAddress(), ethers.parseEther("1"));
    await l2AssetManager.connect(user).deposit(ethers.parseEther("1"));
    expect(await wrappedETH.balanceOf(await user.getAddress())).to.equal(0);

    // User requests to withdraw 1 ETH in L1
    await l1AssetManager.connect(user).requestWithdraw(ethers.parseEther("1"));

    // Fast forward time to after the pending period
    await ethers.provider.send("evm_increaseTime", [pendingPeriod]);
    await ethers.provider.send("evm_mine");

    // User withdraws 1 ETH in L1
    await l1AssetManager.connect(user).withdraw();
    expect(
      await ethers.provider.getBalance(await l1AssetManager.getAddress())
    ).to.equal(0);
  });
});
