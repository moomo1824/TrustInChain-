import React, { useState } from "react";
import Web3 from "web3";

export default function CreateCampaign({ web3, factory, account, onBack }) {
  const [form, setForm]     = useState({ title: "", description: "", goalEth: "", days: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]       = useState(null);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async () => {
    const { title, description, goalEth, days } = form;
    if (!title || !description || !goalEth || !days) {
      setMsg({ type: "error", text: "All fields are required." });
      return;
    }
    if (Number(goalEth) <= 0 || Number(days) <= 0) {
      setMsg({ type: "error", text: "Goal and duration must be positive values." });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const goalWei     = Web3.utils.toWei(goalEth, "ether");
      const durationSec = Number(days) * 86400;
      await factory.methods
        .createCampaign(title, description, goalWei, durationSec)
        .send({ from: account });
      setMsg({ type: "success", text: "TrustInChain campaign deployed to blockchain successfully!" });
      setForm({ title: "", description: "", goalEth: "", days: "" });
    } catch (e) {
      setMsg({ type: "error", text: e.message?.split("\n")[0] || "Transaction failed." });
    }
    setLoading(false);
  };

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="back-row">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <h1 className="section-title" style={{ marginBottom: 0 }}>Create Campaign</h1>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <div className="form-group">
          <label>Campaign Title</label>
          <input
            name="title"
            value={form.title}
            onChange={handle}
            placeholder="e.g. Flood Relief Fund 2025"
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handle}
            rows={4}
            placeholder="Describe the campaign purpose, beneficiaries, and how funds will be used..."
            style={{ resize: "vertical" }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="form-group">
            <label>Funding Goal (ETH)</label>
            <input
              name="goalEth"
              type="number"
              min="0"
              step="0.01"
              value={form.goalEth}
              onChange={handle}
              placeholder="1.0"
            />
          </div>
          <div className="form-group">
            <label>Duration (days)</label>
            <input
              name="days"
              type="number"
              min="1"
              value={form.days}
              onChange={handle}
              placeholder="30"
            />
          </div>
        </div>

        <div className="alert alert-info" style={{ marginBottom: 18 }}>
          This will deploy a new smart contract on the blockchain via MetaMask.
          A gas fee will be charged.
        </div>

        <button
          className="btn-primary"
          style={{ width: "100%", padding: 14, fontSize: 15 }}
          onClick={submit}
          disabled={loading}
        >
          {loading
            ? <><span className="spinner" />Deploying to Blockchain...</>
            : "Deploy TrustInChain Campaign"}
        </button>
      </div>
    </div>
  );
}
