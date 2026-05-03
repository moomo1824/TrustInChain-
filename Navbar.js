import React from "react";

const s = {
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "15px 32px",
    borderBottom: "1px solid var(--border)",
    background: "var(--surface)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  brand: {
    fontFamily: "var(--font-head)",
    fontSize: "1.35rem",
    color: "var(--teal)",
    cursor: "pointer",
    letterSpacing: "-0.3px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  account: {
    background: "#0d1526",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "13px",
    color: "var(--muted)",
    fontFamily: "monospace",
    letterSpacing: "0.3px",
  },
};

export default function Navbar({ account, onConnect, onHome }) {
  const short = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  return (
    <nav style={s.nav}>
      <span style={s.brand} onClick={onHome}>
        <span style={{ fontSize: "1.5rem" }}>⬡</span>
        TrustInChain
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {account ? (
          <span style={s.account}>🟢 {short}</span>
        ) : (
          <button className="btn-primary" onClick={onConnect}>
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
