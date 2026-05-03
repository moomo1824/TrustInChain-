import React, { useState, useEffect, useCallback } from "react";
import Web3 from "web3";

export default function CampaignList({ web3, factory, account, EscrowABI, onCreate, onSelect }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(true);

  const fetchCampaigns = useCallback(async () => {
    if (!factory) return;
    setLoading(true);
    try {
      const addresses = await factory.methods.getCampaigns().call();
      const details = await Promise.all(
        addresses.map(async (addr) => {
          const c    = new web3.eth.Contract(EscrowABI.abi, addr);
          const info = await c.methods.getCampaignInfo().call();
          return { address: addr, ...info };
        })
      );
      setCampaigns([...details].reverse()); 
    } catch (e) {
      console.error("TrustInChain: failed to fetch campaigns", e);
    }
    setLoading(false);
  }, [factory, web3, EscrowABI]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const pct = (collected, goal) =>
    Math.min((Number(collected) / Number(goal)) * 100, 100).toFixed(1);

  const statusTag = (c) => {
    if (c._cancelled)                              return <span className="tag tag-cancel">Cancelled</span>;
    if (Date.now() / 1000 > Number(c._deadline))  return <span className="tag tag-ended">Ended</span>;
    return <span className="tag tag-active">Active</span>;
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="section-title">TrustInChain Campaigns</h1>
          <p className="section-subtitle">
            Every donation, vote and fund release is recorded transparently on-chain
          </p>
        </div>
        <button className="btn-primary" onClick={onCreate}>+ New Campaign</button>
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", marginTop: 40 }}>
          <span className="spinner" /> Loading campaigns from blockchain...
        </p>
      ) : campaigns.length === 0 ? (
        <div className="card" style={{ marginTop: 40, textAlign: "center", padding: 60 }}>
          <p style={{ color: "var(--muted)", fontSize: 16 }}>
            No campaigns yet. Be the first to create one on TrustInChain.
          </p>
          <button className="btn-primary" style={{ marginTop: 20 }} onClick={onCreate}>
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {campaigns.map((c) => (
            <div
              className="card"
              key={c.address}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(c.address)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <h3 style={{ fontFamily: "var(--font-head)", fontSize: "1.1rem", flex: 1, paddingRight: 10 }}>
                  {c._title}
                </h3>
                {statusTag(c)}
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16, minHeight: 38 }}>
                {c._description.length > 80
                  ? c._description.slice(0, 80) + "…"
                  : c._description}
              </p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct(c._amountCollected, c._goal)}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8 }}>
                <span style={{ color: "var(--teal)", fontWeight: 600 }}>
                  {Web3.utils.fromWei(c._amountCollected, "ether")} ETH raised
                </span>
                <span style={{ color: "var(--muted)" }}>
                  of {Web3.utils.fromWei(c._goal, "ether")} ETH
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
                👥 {c._donorCount.toString()} donors
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
