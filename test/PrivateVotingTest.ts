import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { PrivateVoting, PrivateVoting__factory } from "../types";

describe("PrivateVoting", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let voting: PrivateVoting;
  let votingAddress: string;

  before(async function () {
    [deployer, alice] = await ethers.getSigners();
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      throw new Error("This test suite requires local FHEVM");
    }

    const factory = (await ethers.getContractFactory("PrivateVoting")) as PrivateVoting__factory;
    voting = await factory.deploy("Do you agree?", 3, deployer); // 3 seconds duration
    votingAddress = await voting.getAddress();
  });

  it("allows encrypted vote and shows private & public results correctly", async function () {
    const durationSeconds = 3;
    const VotingFactory = (await ethers.getContractFactory("PrivateVoting")) as PrivateVoting__factory;
    const voting = await VotingFactory.deploy("Vote YES or NO", durationSeconds, deployer);
    const votingAddress = await voting.getAddress();

    const input = fhevm.createEncryptedInput(votingAddress, alice.address);
    input.add32(1);
    const encrypted = await input.encrypt();
    await voting.connect(alice).vote(encrypted.handles[0], encrypted.inputProof);

    const [encNoBefore, encYesBefore] = await voting.connect(deployer).getEncryptedResults();
    const privNo = await fhevm.userDecryptEuint(FhevmType.euint32, encNoBefore, votingAddress, deployer);
    const privYes = await fhevm.userDecryptEuint(FhevmType.euint32, encYesBefore, votingAddress, deployer);

    expect(privNo).to.equal(0);
    expect(privYes).to.equal(1);

    await ethers.provider.send("evm_increaseTime", [durationSeconds + 1]);
    await ethers.provider.send("evm_mine");

    await voting.connect(deployer).makeResultsPublic();

    const [encNoAfter, encYesAfter] = await voting.getPublicResults();
    const pubNo = await fhevm.userDecryptEuint(FhevmType.euint32, encNoAfter, votingAddress, alice);
    const pubYes = await fhevm.userDecryptEuint(FhevmType.euint32, encYesAfter, votingAddress, alice);

    expect(pubNo).to.equal(0);
    expect(pubYes).to.equal(1);
  });
});
