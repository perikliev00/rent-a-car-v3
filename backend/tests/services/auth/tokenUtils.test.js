const crypto = require('crypto');
const tokenUtils = require('../../../src/services/auth/tokenUtils');

describe('tokenUtils', () => {
  test('generates 32 cryptographically random bytes rendered as hex', () => {
    const token = tokenUtils.generateRawToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(Buffer.from(token, 'hex')).toHaveLength(32);
  });

  test('tokens are unique across many draws', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i += 1) {
      seen.add(tokenUtils.generateRawToken());
    }
    expect(seen.size).toBe(500);
  });

  test('hashToken produces the SHA-256 digest and never the raw token', () => {
    const token = tokenUtils.generateRawToken();
    const hash = tokenUtils.hashToken(token);

    expect(hash).toBe(crypto.createHash('sha256').update(token, 'utf8').digest('hex'));
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
  });

  test('hashing is deterministic and collision-free for different inputs', () => {
    const a = tokenUtils.generateRawToken();
    const b = tokenUtils.generateRawToken();

    expect(tokenUtils.hashToken(a)).toBe(tokenUtils.hashToken(a));
    expect(tokenUtils.hashToken(a)).not.toBe(tokenUtils.hashToken(b));
  });

  test('hashToken returns null for empty input rather than hashing an empty string', () => {
    expect(tokenUtils.hashToken('')).toBeNull();
    expect(tokenUtils.hashToken(null)).toBeNull();
    expect(tokenUtils.hashToken(undefined)).toBeNull();
  });

  test('safeEqual compares equal-length values without leaking on mismatch', () => {
    const token = tokenUtils.generateRawToken();

    expect(tokenUtils.safeEqual(token, token)).toBe(true);
    expect(tokenUtils.safeEqual(token, tokenUtils.generateRawToken())).toBe(false);
    expect(tokenUtils.safeEqual(token, token.slice(0, 10))).toBe(false);
    expect(tokenUtils.safeEqual('', '')).toBe(false);
  });

  test('isPlausibleRawToken rejects anything that is not a 64-char hex string', () => {
    expect(tokenUtils.isPlausibleRawToken(tokenUtils.generateRawToken())).toBe(true);
    expect(tokenUtils.isPlausibleRawToken('A'.repeat(64))).toBe(true);

    expect(tokenUtils.isPlausibleRawToken('')).toBe(false);
    expect(tokenUtils.isPlausibleRawToken(null)).toBe(false);
    expect(tokenUtils.isPlausibleRawToken('z'.repeat(64))).toBe(false);
    expect(tokenUtils.isPlausibleRawToken('a'.repeat(63))).toBe(false);
    expect(tokenUtils.isPlausibleRawToken('a'.repeat(65))).toBe(false);
    expect(tokenUtils.isPlausibleRawToken("' OR 1=1 --")).toBe(false);
  });
});
