import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  initSDK,
  createInstance,
  SepoliaConfig,
} from "@zama-fhe/relayer-sdk/bundle";
import { FACTORY_ABI, FACTORY_ADDRESS, VOTING_ABI } from "./fheConfig";
import "./App.css";

interface Voting {
  address: string;
  description: string;
  deadline: number;
  creator: string;
  finished: boolean;
  userVoted?: boolean;
  yes?: number;
  no?: number;
}

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.JsonRpcSigner | null>(null);
  const [instance, setInstance] = useState<any>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [myVotes, setMyVotes] = useState<Voting[]>([]);
  const [communityVotes, setCommunityVotes] = useState<Voting[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newDuration, setNewDuration] = useState<number>(0);
  const [newTimeUnit, setNewTimeUnit] = useState<"seconds" | "minutes" | "hours" | "days">("seconds");
  const [hideFinished, setHideFinished] = useState(false);

  useEffect(() => {
    if (!account) return;
    initSDK().then(async () => {
      const inst = await createInstance({ ...SepoliaConfig, network: window.ethereum });
      setInstance(inst);
      const signer = provider!;
      const f = new ethers.Contract(
        FACTORY_ADDRESS,
        FACTORY_ABI,
        signer
      );
      setFactoryContract(f);
    });
  }, [account]);

  useEffect(() => {
    if (factoryContract && account) {
      loadVotings().catch(console.error);
    }
  }, [factoryContract, account]);

  const connect = async () => {
    if (!window.ethereum) return;
    const p = new ethers.BrowserProvider(window.ethereum);
    await p.send("eth_requestAccounts", []);
    const s = await p.getSigner();
    setProvider(s);
    const addr = await s.getAddress();
    setAccount(addr);
  };

  const disconnect = () => {
    window.location.reload();
  };

  const convertToSeconds = () => {
    switch (newTimeUnit) {
      case "minutes": return newDuration * 60;
      case "hours": return newDuration * 3600;
      case "days": return newDuration * 86400;
      default: return newDuration;
    }
  };

  const createVoting = async () => {
    if (!factoryContract || !instance || !provider) return;
    const durationSec = convertToSeconds();
    const tx = await factoryContract.createVoting(newDesc, durationSec);
    await tx.wait();
    setShowCreateModal(false);
    setNewDesc("");
    setNewDuration(0);
    await loadVotings();
  };

  const loadVotings = async () => {
    if (!factoryContract || !provider || !account) return;
    const addresses: string[] = await factoryContract.getAll();

    const loaded: Voting[] = await Promise.all(addresses.map(async (addr) => {
      const voteContract = new ethers.Contract(addr, VOTING_ABI, provider);
      const desc = await voteContract.description();
      const deadline = await voteContract.deadline();
      const creator = await voteContract.creator();
      const voted = await voteContract.hasVoted(account);
      const finished = Date.now() >= Number(deadline) * 1000;

      let yes = 0, no = 0;
      if (finished) {
        try {
          const [yesEnc, noEnc] = await voteContract.getPublicResults();
          yes = parseInt(yesEnc._hex, 16);
          no = parseInt(noEnc._hex, 16);
        } catch (e) {
          console.warn("Results not revealed yet.");
        }
      }

      return {
        address: addr,
        description: desc,
        deadline: Number(deadline),
        creator,
        finished,
        userVoted: voted,
        yes,
        no
      };
    }));

    setCommunityVotes(loaded.filter(v => v.creator.toLowerCase() !== account!.toLowerCase()));
    setMyVotes(loaded.filter(v => v.creator.toLowerCase() === account!.toLowerCase()));
  };

  const submitVote = async (voteContract: ethers.Contract, option: 0 | 1) => {
    if (!instance || !provider || !account) return;
    const voteContractAddress = await voteContract.getAddress()
    const input = await instance.createEncryptedInput(voteContractAddress, account);
    input.add32(option);
    const { handles, inputProof } = await input.encrypt();
    const hexHandle = ethers.hexlify(handles[0]);
    const hexProof = ethers.hexlify(inputProof);
    const tx = await voteContract.vote(hexHandle, hexProof)
    await tx.wait();
    await loadVotings();
  };

  return (
    <div className="App">
      <header className="header">
        {account ? (
          <div className="account">
            🧘‍♂️ {account.slice(0, 6)}…{account.slice(-4)}{" "}
            <button className="btn small" onClick={disconnect}>Disconnect</button>
          </div>
        ) : (
          <button className="btn" onClick={connect}>Connect Wallet</button>
        )}
      </header>

      <div className="hide-toggle">
        <label>
          <input
            type="checkbox"
            checked={hideFinished}
            onChange={e => setHideFinished(e.target.checked)}
          />{" "}
          Hide Finished
        </label>
      </div>

      <main className="grid-rows">
        <section className="column full">
          <div className="section-header">
            <h2>📋 My Votes</h2>
            <div className="section-header">
              <div className="left-controls">
                <button className="btn darkgreen" onClick={() => setShowCreateModal(true)}>
                  ➕ Create Voting
                </button>
              </div>
            </div>
          </div>
          <div className="grid-columns">
            {myVotes.filter(v => !(hideFinished && v.finished)).map(v => (
              <div key={v.address} className="card">
                <h3>{v.description}</h3>
                <p>Status: {v.finished ? "✅ Finished" : "🕒 Ongoing"}</p>
                <p>Deadline: {new Date(v.deadline * 1000).toLocaleString()}</p>
                {v.finished && (
                  <>
                    <p>Vote ended</p>
                    <p>✅ Yes: {v.yes} ({((v.yes! / (v.yes! + v.no!)) * 100).toFixed(1)}%)</p>
                    <p>❌ No: {v.no} ({((v.no! / (v.yes! + v.no!)) * 100).toFixed(1)}%)</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="column full">
          <div className="section-header">
            <h2>🌐 Community Votes</h2>
          </div>
          <div className="grid-columns">
            {communityVotes.filter(v => !(hideFinished && v.finished)).map(v => (
              <div key={v.address} className="card">
                <p>👤 {v.address.slice(0, 6)}…{v.address.slice(-4)}</p>
                <h3>{v.description}</h3>
                <p>Deadline: {new Date(v.deadline * 1000).toLocaleString()}</p>
                {v.finished ? (
                  <>
                    <p>Vote ended</p>
                    <p>✅ Yes: {v.yes} ({((v.yes! / (v.yes! + v.no!)) * 100).toFixed(1)}%)</p>
                    <p>❌ No: {v.no} ({((v.no! / (v.yes! + v.no!)) * 100).toFixed(1)}%)</p>
                  </>
                ) : v.userVoted ? (
                  <p>Voted</p>
                ) : (
                  <div className="actions">
                    <button className="btn small accent" onClick={() => submitVote(new ethers.Contract(v.address, VOTING_ABI, provider!), 1)}>✅ Yes</button>
                    <button className="btn small accent" onClick={() => submitVote(new ethers.Contract(v.address, VOTING_ABI, provider!), 0)}>❌ No</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {showCreateModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Create Voting</h3>
            <textarea
              rows={3}
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Description"
            />
            <div className="time-inputs">
              <input
                type="number"
                value={newDuration}
                onChange={e => setNewDuration(+e.target.value)}
                placeholder="Duration"
              />
              <select
                value={newTimeUnit}
                onChange={e => setNewTimeUnit(e.target.value as any)}
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <button className="btn darkgreen" onClick={createVoting}>Create</button>
            <button className="btn small" onClick={() => setShowCreateModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
