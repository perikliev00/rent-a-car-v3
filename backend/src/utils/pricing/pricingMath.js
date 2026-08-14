function round2(n) {
  return Number((Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function applyAdj(base, adjType, adjValue, days = 1) {
  const value = Number(adjValue) || 0;
  if (adjType === 'fixed_per_day') return round2(value * days);
  if (adjType === 'fixed') return round2(value);
  // percent
  return round2((base * value) / 100);
}

module.exports = {
  round2,
  applyAdj,
};
