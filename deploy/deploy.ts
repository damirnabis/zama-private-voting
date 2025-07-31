import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployVotingFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const result = await deploy("VotingFactory", {
    from: deployer,
    //args: ["Test Vote", 3600, deployer],
    log: true,
  });

  console.log("✅ VotingFactory deployed to:", result.address);
};

export default deployVotingFactory;

deployVotingFactory.tags = ["VotingFactory"];
