const CampaignFactory = artifacts.require("CampaignFactory");

module.exports = function (deployer) {
  // Only CampaignFactory is deployed directly.CampaignEscrow instances are deployed by the factory at runtime when a user creates a new campaign via TrustInChain frontend.
  deployer.deploy(CampaignFactory);
};
