const CampaignFactory = artifacts.require("CampaignFactory");
const CampaignEscrow  = artifacts.require("CampaignEscrow");

const { BN, expectRevert, time } = require("@openzeppelin/test-helpers");

contract("TrustInChain", (accounts) => {
  const owner     = accounts[0];
  const donor1    = accounts[1]; 
  const donor2    = accounts[2]; 
  const donor3    = accounts[3]; 
  const nonDonor  = accounts[4];
  const recipient = accounts[5];

  let factory;
  let campaign;

  const GOAL     = web3.utils.toWei("1", "ether");
  const DURATION = 3600; 

  beforeEach(async () => {
    factory = await CampaignFactory.new({ from: owner });
    const tx = await factory.createCampaign(
      "TrustInChain Test Campaign",
      "Testing transparent donation system",
      GOAL,
      DURATION,
      { from: owner }
    );
    const campaignAddress = tx.logs[0].args.campaignAddress;
    campaign = await CampaignEscrow.at(campaignAddress);
  });

  //Campaign Creation 
  describe("Suite 1 — Campaign Creation (Factory Pattern)", () => {
    it("deploys campaign with correct title, goal, owner", async () => {
      const info = await campaign.getCampaignInfo();
      assert.equal(info._owner, owner, "Owner mismatch");
      assert.equal(info._title, "TrustInChain Test Campaign");
      assert.equal(info._goal.toString(), GOAL);
    });

    it("registers campaign address in TrustInChain factory", async () => {
      const count = await factory.getCampaignCount();
      assert.equal(count.toString(), "1");
    });

    it("emits CampaignDeployed event with correct args", async () => {
      const tx = await factory.createCampaign("C2", "D2", GOAL, DURATION, { from: owner });
      assert.equal(tx.logs[0].event, "CampaignDeployed");
      assert.equal(tx.logs[0].args.owner, owner);
    });

    it("multiple campaigns tracked independently", async () => {
      await factory.createCampaign("C2", "D2", GOAL, DURATION, { from: owner });
      await factory.createCampaign("C3", "D3", GOAL, DURATION, { from: owner });
      const count = await factory.getCampaignCount();
      assert.equal(count.toString(), "3");
    });
  });

  //  Donation
  describe("Suite 2 — Donation (Escrow)", () => {
    it("records donor contribution correctly", async () => {
      const amount = web3.utils.toWei("0.3", "ether");
      await campaign.donate({ from: donor1, value: amount });
      const contrib = await campaign.contributions(donor1);
      assert.equal(contrib.toString(), amount);
    });

    it("adds donor to donors list on first donation", async () => {
      await campaign.donate({ from: donor1, value: web3.utils.toWei("0.1", "ether") });
      const donors = await campaign.getDonors();
      assert.include(donors, donor1);
    });

    it("accumulates multiple donations from same donor", async () => {
      const amt = web3.utils.toWei("0.2", "ether");
      await campaign.donate({ from: donor1, value: amt });
      await campaign.donate({ from: donor1, value: amt });
      const contrib = await campaign.contributions(donor1);
      assert.equal(contrib.toString(), web3.utils.toWei("0.4", "ether"));
    });

    it("rejects zero donation", async () => {
      await expectRevert(
        campaign.donate({ from: donor1, value: 0 }),
        "Zero donation"
      );
    });

    it("rejects donation after deadline", async () => {
      await time.increase(DURATION + 1);
      await expectRevert(
        campaign.donate({ from: donor1, value: web3.utils.toWei("0.1", "ether") }),
        "Deadline passed"
      );
    });

    it("rejects donation to cancelled campaign", async () => {
      await campaign.cancelCampaign({ from: owner });
      await expectRevert(
        campaign.donate({ from: donor1, value: web3.utils.toWei("0.1", "ether") }),
        "Campaign is cancelled"
      );
    });
  });

  // Stake-Weighted Consensus Voting 
  describe("Suite 3 — Stake-Weighted Majority Voting (Consensus)", () => {
    beforeEach(async () => {
      // Total stake = 1 ETH: donor1=50%, donor2=30%, donor3=20%
      await campaign.donate({ from: donor1, value: web3.utils.toWei("0.5", "ether") });
      await campaign.donate({ from: donor2, value: web3.utils.toWei("0.3", "ether") });
      await campaign.donate({ from: donor3, value: web3.utils.toWei("0.2", "ether") });
      await campaign.createSpendingRequest(
        "Purchase medical supplies",
        recipient,
        web3.utils.toWei("0.4", "ether"),
        "QmTrustInChainCID123",
        { from: owner }
      );
    });

    it("records stake-weighted vote correctly", async () => {
      await campaign.approveRequest(0, { from: donor1 });
      const req = await campaign.getRequest(0);
      assert.equal(
        req.approvalStake.toString(),
        web3.utils.toWei("0.5", "ether"),
        "Approval stake should equal donor1 contribution"
      );
    });

    it("BLOCKS double voting — vote deduplication", async () => {
      await campaign.approveRequest(0, { from: donor1 });
      await expectRevert(
        campaign.approveRequest(0, { from: donor1 }),
        "Already voted on this request"
      );
    });

    it("BLOCKS non-donor from voting — Sybil resistance", async () => {
      await expectRevert(
        campaign.approveRequest(0, { from: nonDonor }),
        "Not a donor"
      );
    });

    it("minority stake (20%) does NOT reach majority", async () => {
      await campaign.approveRequest(0, { from: donor3 }); 
      const req = await campaign.getRequest(0);
      assert.equal(req.majorityReached, false, "20% stake should not reach majority");
    });

    it("exactly 50% stake does NOT reach STRICT majority", async () => {
      // donor1 = 0.5 ETH = exactly 50% — strict majority requires >50%
      await campaign.approveRequest(0, { from: donor1 });
      const req = await campaign.getRequest(0);
      assert.equal(req.majorityReached, false, "Exactly 50% should not pass strict majority");
    });

    it("80% stake DOES reach majority", async () => {
      await campaign.approveRequest(0, { from: donor1 }); // 50%
      await campaign.approveRequest(0, { from: donor2 }); // +30% = 80%
      const req = await campaign.getRequest(0);
      assert.equal(req.majorityReached, true, "80% stake should reach majority");
    });

    it("BLOCKS finalization without majority", async () => {
      await campaign.approveRequest(0, { from: donor3 }); // only 20%
      await expectRevert(
        campaign.finalizeSpendingRequest(0, { from: owner }),
        "Stake majority not reached"
      );
    });

    it("FINALIZES successfully with majority stake", async () => {
      await campaign.approveRequest(0, { from: donor1 });
      await campaign.approveRequest(0, { from: donor2 });
      const tx = await campaign.finalizeSpendingRequest(0, { from: owner });
      assert.equal(tx.logs[0].event, "SpendingRequestFinalized");
    });

    it("BLOCKS non-owner from finalizing", async () => {
      await campaign.approveRequest(0, { from: donor1 });
      await campaign.approveRequest(0, { from: donor2 });
      await expectRevert(
        campaign.finalizeSpendingRequest(0, { from: donor1 }),
        "Not campaign owner"
      );
    });

    it("BLOCKS double finalization — idempotency guard", async () => {
      await campaign.approveRequest(0, { from: donor1 });
      await campaign.approveRequest(0, { from: donor2 });
      await campaign.finalizeSpendingRequest(0, { from: owner });
      await expectRevert(
        campaign.finalizeSpendingRequest(0, { from: owner }),
        "Already finalized"
      );
    });
  });

  // Refund
  describe("Suite 4 — Refund (Pull Payment + CEI)", () => {
    beforeEach(async () => {
      await campaign.donate({ from: donor1, value: web3.utils.toWei("0.3", "ether") });
    });

    it("BLOCKS refund while campaign is active", async () => {
      await expectRevert(
        campaign.claimRefund({ from: donor1 }),
        "Campaign still active"
      );
    });

    it("allows refund after deadline if goal not met", async () => {
      await time.increase(DURATION + 1);
      const before = new BN(await web3.eth.getBalance(donor1));
      await campaign.claimRefund({ from: donor1 });
      const after = new BN(await web3.eth.getBalance(donor1));
      assert(after.gt(before), "Donor balance should increase after refund");
    });

    it("zeroes contribution after refund — reentrancy protection", async () => {
      await time.increase(DURATION + 1);
      await campaign.claimRefund({ from: donor1 });
      const contrib = await campaign.contributions(donor1);
      assert.equal(contrib.toString(), "0");
    });

    it("BLOCKS second refund claim", async () => {
      await time.increase(DURATION + 1);
      await campaign.claimRefund({ from: donor1 });
      await expectRevert(
        campaign.claimRefund({ from: donor1 }),
        "Nothing to refund"
      );
    });

    it("allows refund after cancellation", async () => {
      await campaign.cancelCampaign({ from: owner });
      await campaign.claimRefund({ from: donor1 });
      const contrib = await campaign.contributions(donor1);
      assert.equal(contrib.toString(), "0");
    });
  });

  //  Cancellation 
  describe("Suite 5 — Campaign Cancellation (State Flag, No Loop)", () => {
    it("owner can cancel active campaign", async () => {
      await campaign.cancelCampaign({ from: owner });
      const info = await campaign.getCampaignInfo();
      assert.equal(info._cancelled, true);
    });

    it("BLOCKS non-owner from cancelling", async () => {
      await expectRevert(
        campaign.cancelCampaign({ from: donor1 }),
        "Not campaign owner"
      );
    });

    it("BLOCKS double cancellation", async () => {
      await campaign.cancelCampaign({ from: owner });
      await expectRevert(
        campaign.cancelCampaign({ from: owner }),
        "Already cancelled"
      );
    });

    it("BLOCKS donation after cancellation", async () => {
      await campaign.cancelCampaign({ from: owner });
      await expectRevert(
        campaign.donate({ from: donor1, value: web3.utils.toWei("0.1", "ether") }),
        "Campaign is cancelled"
      );
    });
  });
});
