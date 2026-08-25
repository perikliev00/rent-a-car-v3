/**
 * In-memory mail outbox for tests only.
 *
 * Security tokens are never persisted (the DB holds only SHA-256 hashes), so tests need
 * some way to read the raw token that was mailed. This captures outgoing security mail
 * in process memory, gated behind NODE_ENV=test plus an explicit EMAIL_TEST_OUTBOX flag,
 * mirroring the existing STRIPE_STUB pattern. It is inert in every other environment.
 */

const MAX_MESSAGES = 200;

let messages = [];

function isEnabled() {
  return process.env.NODE_ENV === 'test' && process.env.EMAIL_TEST_OUTBOX === '1';
}

function record(message) {
  if (!isEnabled()) {
    return;
  }

  messages.push({
    to: message?.to || null,
    subject: message?.subject || null,
    text: message?.text || null,
    html: message?.html || null,
    kind: message?.kind || null,
    recordedAt: new Date().toISOString(),
  });

  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(-MAX_MESSAGES);
  }
}

function list({ to = null, kind = null } = {}) {
  if (!isEnabled()) {
    return [];
  }

  const normalizedTo = to ? String(to).trim().toLowerCase() : null;

  return messages.filter((message) => {
    if (normalizedTo && String(message.to || '').toLowerCase() !== normalizedTo) {
      return false;
    }
    if (kind && message.kind !== kind) {
      return false;
    }
    return true;
  });
}

function findLatest({ to = null, kind = null } = {}) {
  const matches = list({ to, kind });
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function clear() {
  messages = [];
}

module.exports = {
  isEnabled,
  record,
  list,
  findLatest,
  clear,
};
