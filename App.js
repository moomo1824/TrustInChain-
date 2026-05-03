import React, { useState, useEffect, useCallback } from "react";
import Web3 from "web3";
import FactoryABI from "./contracts/CampaignFactory.json";
import EscrowABI  from "./contracts/CampaignEscrow.json";
import Navbar         from "./components/Navbar";
import CampaignList   from "./components/CampaignList";
import CreateCampaign from "./components/CreateCampaign";
import CampaignDetail from "./components/CampaignDetail";
import "./App.css";

const FACTORY_ADDRESS = "0xYourDeployedFactoryAddressHere";

export default function App() {
  const [web3, setWeb3]                 = useState(null);
  const [account, setAccount]           = useState(null);
  const [factory, setFactory]           = useState(null);
  const [page, setPage]                 = useState("list");
  const [selectedCampaign, setSelected] = useState(null);
  const [status, setStatus]             = useState("");

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setStatus("MetaMask not detected. Please install MetaMask to use TrustInChain.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const w3 = new Web3(window.ethereum);
      const f  = new w3.eth.Contract(FactoryABI.abi, FACTORY_ADDRESS);
      setWeb3(w3);
      setAccount(accounts[0]);
      setFactory(f);
      setStatus("");
    } catch (err) {
      setStatus("Wallet connection rejected.");
    }
  }, []);

  useEffect(() => {
    if (window.ethereum) connectWallet();
    window.ethereum?.on("accountsChanged", (accs) => setAccount(accs[0]));
  }, [connectWallet]);

  const openCampaign = (address) => { setSelected(address); setPage("detail"); };
  const goHome       = ()         => { setSelected(null);   setPage("list");   };

  return (
    <div className="app">
      <Navbar account={account} onConnect={connectWallet} onHome={goHome} />

      {status && <div className="status-banner">{status}</div>}

      {!account ? (
        <div className="connect-prompt">
          <div className="connect-logo">⬡</div>
          <h1>TrustInChain</h1>
          <p>Blockchain-powered transparent donation platform</p>
          <p className="connect-sub">Connect your MetaMask wallet to get started</p>
          <button className="btn-primary" onClick={connectWallet}>
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          {page === "list"   && (
            <CampaignList
              web3={web3}
              factory={factory}
              account={account}
              EscrowABI={EscrowABI}
              onCreate={() => setPage("create")}
              onSelect={openCampaign}
            />
          )}
          {page === "create" && (
            <CreateCampaign
              web3={web3}
              factory={factory}
              account={account}
              onBack={goHome}
            />
          )}
          {page === "detail" && selectedCampaign && (
            <CampaignDetail
              web3={web3}
              account={account}
              campaignAddress={selectedCampaign}
              EscrowABI={EscrowABI}
              onBack={goHome}
            />
          )}
        </>
      )}
    </div>
  );
}
