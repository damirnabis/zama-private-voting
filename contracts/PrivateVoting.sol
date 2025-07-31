// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "contracts/fhevm/ZamaConfig.sol";

contract PrivateVoting is SepoliaConfig {
    event Debug(string info);

    string public description;
    uint256 public deadline;
    address public creator;

    euint32 private votes0;
    euint32 private votes1;

    bool public resultsRevealed;
    mapping(address => bool) public hasVoted;

    constructor(string memory _description, uint256 _durationSeconds, address _creator) {
        description = _description;
        deadline = block.timestamp + _durationSeconds;
        creator = _creator;
        resultsRevealed = false;
    }

    function vote(externalEuint32 encryptedVote, bytes calldata attestation) external {
        require(block.timestamp < deadline, "Voting has ended");
        require(!hasVoted[msg.sender], "Already voted");

        euint32 voteValue = FHE.fromExternal(encryptedVote, attestation);
        FHE.allow(voteValue, address(this));

        votes1 = FHE.add(votes1, voteValue);

        euint32 one = FHE.asEuint32(1);
        euint32 inverted = FHE.sub(one, voteValue);
        votes0 = FHE.add(votes0, inverted);

        FHE.allowThis(votes0);
        FHE.allowThis(votes1);
        FHE.allow(votes0, creator);
        FHE.allow(votes1, creator);
        FHE.allow(votes0, msg.sender);
        FHE.allow(votes1, msg.sender);

        hasVoted[msg.sender] = true;
    }

    function makeResultsPublic() external {
        require(block.timestamp >= deadline, "Voting is still ongoing");
        require(!resultsRevealed, "Results already revealed");

        FHE.makePubliclyDecryptable(votes0);
        FHE.makePubliclyDecryptable(votes1);

        resultsRevealed = true;
    }

    function getPublicResults() external view returns (euint32, euint32) {
        require(resultsRevealed, "Results not revealed yet");
        return (votes0, votes1);
    }

    function getEncryptedResults() external view returns (euint32, euint32) {
        require(msg.sender == creator, "Not allowed");
        return (votes0, votes1);
    }
}
