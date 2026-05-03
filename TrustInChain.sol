// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


contract CampaignEscrow {

    // ── State ────────────────────────────────────────────────
    address public owner;
    string  public title;
    string  public description;
    uint256 public goal;
    uint256 public deadline;
    uint256 public amountCollected;
    bool    public cancelled;
    bool    public goalReached;

    address[] public donors;
    mapping(address => uint256) public contributions;

    // ── Spending Requests ────────────────────────────────────
    struct Request {
        string  purpose;
        address payable recipient;
        uint256 amount;
        string  evidenceCID;    // IPFS CID of invoice
        bool    completed;
        uint256 approvalStake;  // stake-weighted votes FOR
    }

    Request[] public spendingRequests;

    // Stake-weighted consensus: requestId => donor => voted?
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ── Events ───────────────────────────────────────────────
    event DonationReceived(address indexed donor, uint256 amount);
    event RequestCreated(uint256 indexed requestId, string purpose, uint256 amount);
    event RequestApproved(uint256 indexed requestId, address indexed donor, uint256 weight);
    event SpendingRequestFinalized(uint256 indexed requestId, address recipient, uint256 amount);
    event RefundClaimed(address indexed donor, uint256 amount);
    event CampaignCancelled();

    // ── Modifiers ────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not campaign owner");
        _;
    }

    modifier notCancelled() {
        require(!cancelled, "Campaign is cancelled");
        _;
    }

    // ── Constructor ──────────────────────────────────────────
    constructor(
        address _owner,
        string memory _title,
        string memory _description,
        uint256 _goalWei,
        uint256 _durationInSeconds
    ) {
        owner       = _owner;
        title       = _title;
        description = _description;
        goal        = _goalWei;
        deadline    = block.timestamp + _durationInSeconds;
    }

    // ── Feature 1: Donate ────────────────────────────────────
    /// @notice Send ETH to contribute to this TrustInChain campaign
    function donate() external payable notCancelled {
        require(block.timestamp < deadline,               "Deadline passed");
        require(msg.value > 0,                            "Zero donation");
        require(amountCollected + msg.value <= goal * 2,  "Exceeds funding cap");

        if (contributions[msg.sender] == 0) {
            donors.push(msg.sender);
        }
        contributions[msg.sender] += msg.value;
        amountCollected           += msg.value;

        if (amountCollected >= goal) {
            goalReached = true;
        }

        emit DonationReceived(msg.sender, msg.value);
    }

    // ── Feature 2: Create Spending Request ───────────────────
    /// @notice Owner creates a spending request; donors then vote
    function createSpendingRequest(
        string calldata _purpose,
        address payable _recipient,
        uint256 _amount,
        string calldata _evidenceCID
    ) external onlyOwner notCancelled {
        require(_amount <= address(this).balance, "Amount exceeds balance");
        require(donors.length > 0,                "No donors yet");

        spendingRequests.push(Request({
            purpose:       _purpose,
            recipient:     _recipient,
            amount:        _amount,
            evidenceCID:   _evidenceCID,
            completed:     false,
            approvalStake: 0
        }));

        emit RequestCreated(spendingRequests.length - 1, _purpose, _amount);
    }

    // ── Feature 3: Stake-Weighted Approval (Consensus) ───────
    /// @notice Donor votes to approve a spending request.
    ///         Vote weight = donor's ETH contribution (stake-weighted).
    ///         Consensus = approvalStake * 2 > amountCollected (strict >50%).
    function approveRequest(uint256 requestId) external notCancelled {
        require(contributions[msg.sender] > 0,           "Not a donor");
        require(requestId < spendingRequests.length,     "Invalid request ID");
        require(!spendingRequests[requestId].completed,  "Request already finalized");
        require(!hasVoted[requestId][msg.sender],        "Already voted on this request");

        hasVoted[requestId][msg.sender]           = true;
        spendingRequests[requestId].approvalStake += contributions[msg.sender];

        emit RequestApproved(requestId, msg.sender, contributions[msg.sender]);
    }

    // ── Feature 4: Finalize Spending Request ─────────────────
    /// @notice Release funds once stake-weighted majority (>50%) is reached.
    ///         Strict majority: approvalStake * 2 > amountCollected
    function finalizeSpendingRequest(uint256 requestId) external onlyOwner notCancelled {
        require(requestId < spendingRequests.length,    "Invalid request ID");
        Request storage r = spendingRequests[requestId];
        require(!r.completed,                           "Already finalized");
        require(donors.length > 0,                      "No donors");
        // Stake-weighted strict majority consensus
        require(r.approvalStake * 2 > amountCollected,  "Stake majority not reached");
        require(address(this).balance >= r.amount,      "Insufficient contract balance");

        r.completed = true;
        r.recipient.transfer(r.amount);

        emit SpendingRequestFinalized(requestId, r.recipient, r.amount);
    }

    // ── Feature 5: Claim Refund (Pull Payment + CEI) ─────────
    /// @notice Donor claims refund if campaign failed or was cancelled.
    ///         Pull Payment Pattern + Checks-Effects-Interactions (reentrancy safe).
    function claimRefund() external {
        require(
            cancelled || block.timestamp >= deadline,
            "Campaign still active"
        );
        require(
            !goalReached || cancelled,
            "Goal was met — no refunds available"
        );
        uint256 contributed = contributions[msg.sender];
        require(contributed > 0, "Nothing to refund");

        // Checks-Effects-Interactions: zero state before transfer
        contributions[msg.sender]  = 0;
        amountCollected           -= contributed;

        payable(msg.sender).transfer(contributed);
        emit RefundClaimed(msg.sender, contributed);
    }

    // ── Feature 6: Cancel Campaign (State Flag — no loop) ────
    /// @notice Owner cancels campaign. Donors pull refunds individually.
    ///         No loop — avoids DoS via unbounded gas consumption.
    function cancelCampaign() external onlyOwner {
        require(!cancelled, "Already cancelled");
        cancelled = true;
        emit CampaignCancelled();
    }

    // ── View Helpers ─────────────────────────────────────────
    function getDonors() external view returns (address[] memory) {
        return donors;
    }

    function getRequestCount() external view returns (uint256) {
        return spendingRequests.length;
    }

    function getRequest(uint256 requestId) external view returns (
        string memory purpose,
        address recipient,
        uint256 amount,
        string memory evidenceCID,
        bool completed,
        uint256 approvalStake,
        bool majorityReached
    ) {
        Request storage r = spendingRequests[requestId];
        return (
            r.purpose,
            r.recipient,
            r.amount,
            r.evidenceCID,
            r.completed,
            r.approvalStake,
            r.approvalStake * 2 > amountCollected
        );
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getCampaignInfo() external view returns (
        address _owner,
        string memory _title,
        string memory _description,
        uint256 _goal,
        uint256 _deadline,
        uint256 _amountCollected,
        bool _cancelled,
        bool _goalReached,
        uint256 _donorCount
    ) {
        return (
            owner,
            title,
            description,
            goal,
            deadline,
            amountCollected,
            cancelled,
            goalReached,
            donors.length
        );
    }
}


contract CampaignFactory {

    address[] public campaigns;

    event CampaignDeployed(
        address indexed campaignAddress,
        address indexed owner,
        string title
    );

    /// @notice Deploy a new isolated CampaignEscrow contract
    function createCampaign(
        string calldata title,
        string calldata description,
        uint256 goalWei,
        uint256 durationInSeconds
    ) external returns (address campaignAddress) {
        CampaignEscrow c = new CampaignEscrow(
            msg.sender,
            title,
            description,
            goalWei,
            durationInSeconds
        );
        campaignAddress = address(c);
        campaigns.push(campaignAddress);
        emit CampaignDeployed(campaignAddress, msg.sender, title);
    }

    function getCampaigns() external view returns (address[] memory) {
        return campaigns;
    }

    function getCampaignCount() external view returns (uint256) {
        return campaigns.length;
    }
}
