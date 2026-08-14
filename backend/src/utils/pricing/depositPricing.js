const { round2 } = require('./pricingMath');

function activeDeposit(config) {
  return (config.depositRules || []).find((d) => d.active) || null;
}

function resolveDeposit(cfg) {
  const depositRule = activeDeposit(cfg);
  return depositRule ? round2(depositRule.defaultAmount) : 0;
}

module.exports = {
  activeDeposit,
  resolveDeposit,
};
