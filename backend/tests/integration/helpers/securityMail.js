const testOutbox = require('../../../src/services/email/testOutbox');

const TOKEN_IN_URL = /[?&]token=([0-9a-fA-F]{64})/;

function extractToken(message) {
  const match = String(message?.text || '').match(TOKEN_IN_URL);
  return match ? match[1] : null;
}

function latestTokenFor(to, kind) {
  const message = testOutbox.findLatest({ to, kind });
  return extractToken(message);
}

function latestVerificationToken(to) {
  return latestTokenFor(to, 'email_verification');
}

function latestClaimToken(to) {
  return latestTokenFor(to, 'reservation_claim');
}

function countMail(to, kind) {
  return testOutbox.list({ to, kind }).length;
}

function clearMail() {
  testOutbox.clear();
}

module.exports = {
  extractToken,
  latestVerificationToken,
  latestClaimToken,
  countMail,
  clearMail,
};
