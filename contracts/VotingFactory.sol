// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PrivateVoting.sol";

contract VotingFactory {
    address[] public votings;

    event VotingCreated(address voting);

    function createVoting(string memory _desc, uint256 _duration) external {
        PrivateVoting v = new PrivateVoting(_desc, _duration, msg.sender);
        votings.push(address(v));
        emit VotingCreated(address(v));
    }

    function getVoting(uint256 index) public view returns (address) {
        return votings[index];
    }

    function getAll() public view returns (address[] memory) {
        return votings;
    }
}
