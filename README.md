#Project-Final

---

## Folder Structure

```
TrustInChain/
├── TrustInChain_Backend/                 
│   ├── build/contracts/                 
│   │   ├── CampaignEscrow.json
│   │   └── CampaignFactory.json
│   ├── contracts/ 
│   │   └── TrustInChain.sol
│   ├── migrations/
│   │   └── 2_deploy_contracts.js
│   ├── test/
│   │   └── trustinchain.test.js
│   ├── package.json
│   └── truffle-config.js
│
├── TrustInChain_Frontend/                
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── contracts/                    
│   │   │   ├── CampaignEscrow.json
│   │   │   └── CampaignFactory.json
│   │   ├── components/
│   │   │   ├── Navbar.js
│   │   │   ├── CampaignList.js
│   │   │   ├── CreateCampaign.js
│   │   │   └── CampaignDetail.js
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── indexx.css
│   └── packagee.json
│
└── README.md
```

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- Truffle: `npm install -g truffle`
- Ganache GUI (download from trufflesuite.com)
- MetaMask browser extension

---

### Step 1 — Start Ganache
1. Open Ganache GUI → click **Quickstart (Ethereum)**
2. Confirm it runs on `HTTP://127.0.0.1:7545`

---

### Step 2 — Compile & Deploy Smart Contracts

```bash
cd TrustInChain_Backend
npm install
truffle compile
truffle migrate --reset
```

Note the **CampaignFactory contract address** printed in terminal output.

---

### Step 3 — Update Frontend

Open `TrustInChain_Frontend/src/App.js` and replace:
```js
const FACTORY_ADDRESS = "0xYourDeployedFactoryAddressHere";
```
with the address from Step 2.

Copy ABI files:
```bash
cp TrustInChain_Backend/build/contracts/CampaignFactory.json TrustInChain_Frontend/src/contracts/
cp TrustInChain_Backend/build/contracts/CampaignEscrow.json  TrustInChain_Frontend/src/contracts/
```

---

### Step 4 — Run Frontend

```bash
cd TrustInChain_Frontend
npm install
npm start
```

Open `http://localhost:3000`

---

### Step 5 — Connect MetaMask to Ganache
1. MetaMask → Add Network
2. RPC URL: `http://127.0.0.1:7545`
3. Chain ID: `1337`
4. Import a Ganache account via private key

---

### Step 6 — Run Tests

```bash
cd TrustInChain_Backend
truffle test
```

---

## Consensus Algorithm
- **Application layer:** Stake-Weighted Majority Voting (etherium pos) (>50% of total ETH stake)

