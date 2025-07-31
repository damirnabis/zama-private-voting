import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ===========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the FHECounter contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the FHECounter contract
 *
 *   npx hardhat --network localhost task:decrypt-count
 *   npx hardhat --network localhost task:increment --value 2
 *   npx hardhat --network localhost task:decrement --value 1
 *   npx hardhat --network localhost task:decrypt-count
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the FHECounter contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the FHECounter contract
 *
 *   npx hardhat --network sepolia task:decrypt-count
 *   npx hardhat --network sepolia task:increment --value 2
 *   npx hardhat --network sepolia task:decrement --value 1
 *   npx hardhat --network sepolia task:decrypt-count
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:address
 *   - npx hardhat --network sepolia task:address
 */

task("task:address", "Prints the PrivateVoting address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const fheCounter = await deployments.get("PrivateVoting");

  console.log("PrivateVoting address is " + fheCounter.address);
});

task("task:vote", "Calls the vote() function of PrivateVoting Contract")
  .addOptionalParam("address", "Optionally specify the PrivateVoting contract address")
  .addParam("value", "The vote value")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const value = parseInt(taskArguments.value);
    if (!Number.isInteger(value)) {
      throw new Error(`Argument --value is not an integer`);
    }

    await fhevm.initializeCLIApi();

    const PrivateVotingDeployement = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("PrivateVoting");
    console.log(`PrivateVoting: ${PrivateVotingDeployement.address}`);

    const signers = await ethers.getSigners();

    const fhePrivateVoting = await ethers.getContractAt("PrivateVoting", PrivateVotingDeployement.address);

    // Encrypt the value passed as argument
    const encryptedValue = await fhevm
      .createEncryptedInput(PrivateVotingDeployement.address, signers[0].address)
      .add32(value)
      .encrypt();

    const tx = await fhePrivateVoting.connect(signers[0]).vote(encryptedValue.handles[0], encryptedValue.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`PrivateVoting vote(${value}) succeeded!`);
  });
