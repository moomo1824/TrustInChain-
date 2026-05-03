import React, { useState, useEffect, useCallback } from "react";
import Web3 from "web3";

export default function CampaignDetail({ web3, account, campaignAddress, EscrowABI, onBack }) {
  const [contract, setContract]   = useState(null);
  const [info, setInfo]           = useState(null);
  const [requests, setRequests]   = useState([]);
  const [myContrib, setMyContrib] = useState("0");
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState(null);
  const [donateAmt, setDonateAmt] = useState("");
  const [txBusy, setTxBusy]       = useState(false);
  const [reqForm, setReqForm]     = useState({
    purpose: "", recipient: "", amount: "", cid: ""
  });

  //Load all campaign data
  const load = useCallback(async () => {
    if (!web3 || !campaignAddress) return;
    const c = new web3.eth.Contract(EscrowABI.abi, campaignAddress);
    setContract(c);

    const [campaignInfo, contribRaw, reqCount] = await Promise.all([
      c.methods.getCampaignInfo().call(),
      c.methods.contributions(account).call(),
      c.methods.getRequestCount().call(),
    ]);
    setInfo(campaignInfo);
    setMyContrib(contribRaw);

    const reqs = [];
    for (let i = 0; i < Number(reqCount); i++) {
      const r     = await c.methods.getRequest(i).call();
      const voted = await c.methods.hasVoted(i, account).call();
      reqs.push({ ...r, id: i, voted });
    }
    setRequests(reqs);
    setLoading(false);
  }, [web3, campaignAddress, account, EscrowABI]);

  useEffect(() => { load(); }, [load]);

  const notify = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 6000);
  };

  const tx = async (fn, successMsg) => {
    setTxBusy(true);
    try {
      await fn();
      notify("success", successMsg);
      await load();
    } catch (e) {
      notify("error", e.message?.split("\n")[0] || "Transaction failed.");
    }
    setTxBusy(false);
  };

  // Transaction actions
  const donate = () => {
    if (!donateAmt || Number(donateAmt) <= 0)
      return notify("error", "Enter a valid ETH amount.");
    tx(
      () => contract.methods.donate().send({
        from: account,
        value: Web3.utils.toWei(donateAmt, "ether")
      }),
      `Donated ${donateAmt} ETH to TrustInChain campaign!`
    );
  };

  const approveRequest = (id) => tx(
    () => contract.methods.approveRequest(id).send({ from: account }),
    "Stake-weighted vote recorded on-chain successfully."
  );

  const finalizeRequest = (id) => tx(
    () => contract.methods.finalizeSpendingRequest(id).send({ from: account }),
    "Spending request finalized — funds transferred to recipient."
  );

  const claimRefund = () => tx(
    () => contract.methods.claimRefund().send({ from: account }),
    "Refund claimed successfully."
  );

  const cancelCampaign = () => tx(
    () => contract.methods.cancelCampaign().send({ from: account }),
    "TrustInChain campaign cancelled."
  );

  const createRequest = () => {
    const { purpose, recipient, amount, cid } = reqForm;
    if (!purpose || !recipient || !amount)
      return notify("error", "Purpose, recipient and amount are required.");
    tx(
      () => contract.methods
        .createSpendingRequest(
          purpose,
          recipient,
          Web3.utils.toWei(amount, "ether"),
          cid || ""
        )
        .send({ from: account }),
      "Spending request created — donors can now vote."
    );
  };

  //Computed
  const isOwner  = info && info._owner.toLowerCase() === account.toLowerCase();
  const isDonor  = myContrib !== "0";
  const isActive = info && !info._cancelled && Date.now() / 1000 < Number(info._deadline);
  const pct      = info
    ? Math.min((Number(info._amountCollected) / Number(info._goal)) * 100, 100).toFixed(1)
    : 0;
  const timeLeft = info
    ? Math.max(0, Math.floor((Number(info._deadline) - Date.now() / 1000) / 86400))
    : 0;

  const approvalPct = (r) => {
    if (!info || info._amountCollected === "0") return 0;
    return ((Number(r.approvalStake) / Number(info._amountCollected)) * 100).toFixed(1);
  };

  if (loading) return (
    <div className="page" style={{ textAlign: "center", paddingTop: 100 }}>
      <span className="spinner" /> Loading TrustInChain campaign...
    </div>
  );

  return (
    <div className="page">

      {/* Back + status tags */}
      <div className="back-row">
        <button className="btn-secondary" onClick={onBack}>← All Campaigns</button>
        {info._cancelled && <span className="tag tag-cancel">Cancelled</span>}
        {!info._cancelled && !isActive && <span className="tag tag-ended">Ended</span>}
        {isActive && <span className="tag tag-active">Active</span>}
        {isOwner && <span className="tag" style={{ background: "#1e3a5f40", color: "#38bdf8", border: "1px solid #1e3a5f" }}>You are the Owner</span>}
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Title & description */}
      <h1 className="section-title">{info._title}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 28, maxWidth: 700 }}>{info._description}</p>

      {/* Stats */}
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-val">{Web3.utils.fromWei(info._amountCollected, "ether")}</div>
          <div className="stat-lbl">ETH Raised</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{Web3.utils.fromWei(info._goal, "ether")}</div>
          <div className="stat-lbl">Goal (ETH)</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{info._donorCount.toString()}</div>
          <div className="stat-lbl">Donors</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{timeLeft}d</div>
          <div className="stat-lbl">Days Left</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{pct}%</div>
          <div className="stat-lbl">Funded</div>
        </div>
      </div>

      <div className="progress-bar" style={{ height: 8 }}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {isDonor && (
        <p style={{ fontSize: 13, color: "var(--teal)", marginTop: 8 }}>
          ✓ Your stake: {Web3.utils.fromWei(myContrib, "ether")} ETH
        </p>
      )}

      <hr className="divider" />

      {/* ── Donate ── */}
      {isActive && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 6, fontFamily: "var(--font-head)" }}>Donate</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
            Your contribution is held in escrow and only released via donor-approved spending requests.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount in ETH"
              value={donateAmt}
              onChange={(e) => setDonateAmt(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn-primary" onClick={donate} disabled={txBusy} style={{ whiteSpace: "nowrap" }}>
              {txBusy ? <span className="spinner" /> : "Donate"}
            </button>
          </div>
        </div>
      )}

      {/* ── Refund ── */}
      {isDonor && (info._cancelled || (!isActive && !info._goalReached)) && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 8, fontFamily: "var(--font-head)" }}>Claim Refund</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
            {info._cancelled
              ? "This campaign was cancelled by the owner."
              : "This campaign ended without reaching its goal."}
            {" "}You can reclaim your contribution.
          </p>
          <button className="btn-secondary" onClick={claimRefund} disabled={txBusy}>
            {txBusy
              ? <span className="spinner" />
              : `Refund ${Web3.utils.fromWei(myContrib, "ether")} ETH`}
          </button>
        </div>
      )}

      {/* ── Cancel ── */}
      {isOwner && isActive && (
        <div style={{ marginBottom: 24 }}>
          <button className="btn-danger" onClick={cancelCampaign} disabled={txBusy}>
            {txBusy ? <span className="spinner" /> : "Cancel Campaign"}
          </button>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            Cancelling allows all donors to claim individual refunds.
          </p>
        </div>
      )}

      <hr className="divider" />

      {/* ── Spending Requests ── */}
      <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.5rem", marginBottom: 6 }}>
        Spending Requests
      </h2>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        Stake-weighted majority voting consensus — requires {">"}50% of total contributed ETH to approve
      </p>

      {requests.length === 0
        ? <div className="alert alert-info">No spending requests have been created yet.</div>
        : requests.map((r) => (
          <div className={`request-card ${r.completed ? "completed" : ""}`} key={r.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <strong style={{ fontFamily: "var(--font-head)", fontSize: "1rem" }}>
                #{r.id + 1} — {r.purpose}
              </strong>
              {r.completed
                ? <span className="tag tag-active">✓ Finalized</span>
                : r.majorityReached
                  ? <span className="tag tag-ready">Ready to Finalize</span>
                  : <span className="tag tag-ended">Voting Open</span>
              }
            </div>

            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
              <span>Amount: <b style={{ color: "var(--text)" }}>{Web3.utils.fromWei(r.amount, "ether")} ETH</b></span>
              <span>Recipient: <code style={{ fontSize: 12 }}>{r.recipient.slice(0, 12)}…</code></span>
              {r.evidenceCID && r.evidenceCID !== "" && (
                <span>
                  IPFS CID:{" "}
                  <code style={{ fontSize: 11, color: "var(--teal)" }}>
                    {r.evidenceCID.slice(0, 24)}…
                  </code>
                </span>
              )}
            </div>

            {/* Consensus progress bar */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                <span>Approval Stake ({approvalPct(r)}% of total)</span>
                <span style={{ color: Number(approvalPct(r)) > 50 ? "var(--success)" : "var(--muted)" }}>
                  {Number(approvalPct(r)) > 50 ? "✓ Majority reached" : `Need >50%`}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${approvalPct(r)}%` }} />
              </div>
            </div>

            {/* Action buttons */}
            {!r.completed && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {isDonor && !r.voted && (
                  <button
                    className="btn-primary"
                    style={{ padding: "8px 20px", fontSize: 13 }}
                    onClick={() => approveRequest(r.id)}
                    disabled={txBusy}
                  >
                    ✓ Approve Request
                  </button>
                )}
                {isDonor && r.voted && (
                  <span style={{ fontSize: 13, color: "var(--teal)" }}>✓ You have voted</span>
                )}
                {isOwner && r.majorityReached && (
                  <button
                    className="btn-secondary"
                    style={{ padding: "8px 20px", fontSize: 13 }}
                    onClick={() => finalizeRequest(r.id)}
                    disabled={txBusy}
                  >
                    Finalize & Release Funds
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      }

      {/* ── Create Spending Request (owner only) ── */}
      {isOwner && !info._cancelled && (
        <>
          <hr className="divider" />
          <h3 style={{ fontFamily: "var(--font-head)", fontSize: "1.25rem", marginBottom: 14 }}>
            Create New Spending Request
          </h3>
          <div className="card">
            <div className="form-group">
              <label>Purpose</label>
              <input
                placeholder="e.g. Purchase medical supplies for beneficiaries"
                value={reqForm.purpose}
                onChange={(e) => setReqForm({ ...reqForm, purpose: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Recipient Wallet Address</label>
              <input
                placeholder="0x..."
                value={reqForm.recipient}
                onChange={(e) => setReqForm({ ...reqForm, recipient: e.target.value })}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label>Amount (ETH)</label>
                <input
                  type="number" min="0" step="0.01"
                  placeholder="0.5"
                  value={reqForm.amount}
                  onChange={(e) => setReqForm({ ...reqForm, amount: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>IPFS Evidence CID (optional)</label>
                <input
                  placeholder="QmXxx... (receipt/invoice CID)"
                  value={reqForm.cid}
                  onChange={(e) => setReqForm({ ...reqForm, cid: e.target.value })}
                />
              </div>
            </div>
            <button className="btn-primary" onClick={createRequest} disabled={txBusy}>
              {txBusy ? <span className="spinner" /> : "Submit Spending Request"}
            </button>
          </div>
        </>
      )}

      <hr className="divider" />
      <p style={{ fontSize: 11, color: "var(--muted)" }}>
        TrustInChain Contract: <code style={{ fontSize: 11 }}>{campaignAddress}</code>
      </p>
    </div>
  );
}
