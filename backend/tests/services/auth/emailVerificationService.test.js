jest.mock('../../../src/db/transaction', () => ({
  runWithTransaction: jest.fn((fn) => fn('mock-client')),
  clientQuery: jest.fn(),
}));

jest.mock('../../../src/services/sql/emailVerificationTokenSqlService', () => ({
  revokeActiveForUser: jest.fn().mockResolvedValue(0),
  insertToken: jest.fn(),
  findByTokenHash: jest.fn(),
  findByTokenHashForUpdate: jest.fn(),
  markUsed: jest.fn().mockResolvedValue(1),
  findLatestForUser: jest.fn().mockResolvedValue(null),
  findActiveForUser: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserById: jest.fn(),
  lockUserByIdForUpdate: jest.fn(),
  markEmailVerified: jest.fn(),
}));

jest.mock('../../../src/services/email/securityEmailService', () => ({
  sendEmailVerificationEmail: jest.fn().mockResolvedValue({ sent: true }),
}));

const tokenSql = require('../../../src/services/sql/emailVerificationTokenSqlService');
const userSql = require('../../../src/services/sql/userSqlService');
const securityEmail = require('../../../src/services/email/securityEmailService');
const { hashToken } = require('../../../src/services/auth/tokenUtils');
const service = require('../../../src/services/auth/emailVerificationService');

const { OUTCOMES } = service;

const unverifiedUser = {
  id: '5',
  email: 'user@example.com',
  emailVerified: false,
};

const verifiedUser = { ...unverifiedUser, emailVerified: true };
const EMAIL_HASH = hashToken('user@example.com');

function futureDate(ms = 60_000) {
  return new Date(Date.now() + ms);
}

function pastDate(ms = 60_000) {
  return new Date(Date.now() - ms);
}

function boundToken(overrides = {}) {
  return {
    id: '1',
    userId: '5',
    emailHash: EMAIL_HASH,
    expiresAt: futureDate(),
    usedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

describe('emailVerificationService.issueToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenSql.insertToken.mockResolvedValue({ id: '1' });
    userSql.lockUserByIdForUpdate.mockResolvedValue(unverifiedUser);
  });

  test('stores only a SHA-256 hash, never the raw token', async () => {
    const { rawToken } = await service.issueToken(unverifiedUser);

    const [payload] = tokenSql.insertToken.mock.calls[0];
    expect(payload.tokenHash).toBe(hashToken(rawToken));
    expect(payload.tokenHash).not.toBe(rawToken);
    expect(payload.emailHash).toBe(EMAIL_HASH);
    expect(JSON.stringify(payload)).not.toContain(rawToken);
  });

  test('locks the user then revokes outstanding tokens before issuing a new one', async () => {
    await service.issueToken(unverifiedUser);

    expect(userSql.lockUserByIdForUpdate).toHaveBeenCalledWith('5', 'mock-client');
    expect(tokenSql.revokeActiveForUser).toHaveBeenCalledWith('5', 'mock-client');
    expect(userSql.lockUserByIdForUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      tokenSql.revokeActiveForUser.mock.invocationCallOrder[0]
    );
    expect(tokenSql.revokeActiveForUser.mock.invocationCallOrder[0]).toBeLessThan(
      tokenSql.insertToken.mock.invocationCallOrder[0]
    );
  });

  test('sets an expiry in the future', async () => {
    const before = Date.now();
    const { expiresAt } = await service.issueToken(unverifiedUser);

    expect(new Date(expiresAt).getTime()).toBeGreaterThan(before);
    expect(new Date(expiresAt).getTime()).toBeLessThanOrEqual(
      before + service.TOKEN_TTL_MS + 1000
    );
  });
});

describe('emailVerificationService.issueAndSendVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenSql.insertToken.mockResolvedValue({ id: '1' });
    tokenSql.findActiveForUser.mockResolvedValue(null);
    userSql.lockUserByIdForUpdate.mockResolvedValue(unverifiedUser);
    securityEmail.sendEmailVerificationEmail.mockResolvedValue({ sent: true });
  });

  test('mails the raw token to the account address', async () => {
    await service.issueAndSendVerification(unverifiedUser);

    const [args] = securityEmail.sendEmailVerificationEmail.mock.calls[0];
    expect(args.to).toBe('user@example.com');
    expect(args.rawToken).toMatch(/^[0-9a-f]{64}$/);
  });

  test('does nothing for an already verified account', async () => {
    const result = await service.issueAndSendVerification(verifiedUser);

    expect(result).toEqual({ sent: false, reason: 'already_verified' });
    expect(tokenSql.insertToken).not.toHaveBeenCalled();
    expect(securityEmail.sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  test('reports an undelivered first issue without throwing', async () => {
    securityEmail.sendEmailVerificationEmail.mockResolvedValue({
      sent: false,
      reason: 'smtp_not_configured',
    });

    const result = await service.issueAndSendVerification(unverifiedUser);

    expect(result.sent).toBe(false);
    expect(tokenSql.insertToken).toHaveBeenCalled();
  });

  test('does not revoke the last usable link when a resend fails to deliver', async () => {
    tokenSql.findActiveForUser.mockResolvedValue(boundToken());
    securityEmail.sendEmailVerificationEmail.mockResolvedValue({
      sent: false,
      reason: 'smtp_not_configured',
    });

    const result = await service.issueAndSendVerification(unverifiedUser, { resend: true });

    expect(result.sent).toBe(false);
    expect(tokenSql.revokeActiveForUser).not.toHaveBeenCalled();
    expect(tokenSql.insertToken).not.toHaveBeenCalled();
  });
});

describe('emailVerificationService.verifyToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenSql.markUsed.mockResolvedValue(1);
  });

  test('verifies the account for a valid token', async () => {
    tokenSql.findByTokenHash.mockResolvedValue(boundToken());
    tokenSql.findByTokenHashForUpdate.mockResolvedValue(boundToken());
    userSql.lockUserByIdForUpdate.mockResolvedValue(unverifiedUser);
    userSql.markEmailVerified.mockResolvedValue(verifiedUser);

    const result = await service.verifyToken('a'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.VERIFIED);
    expect(userSql.markEmailVerified).toHaveBeenCalledWith('5', 'mock-client');
    expect(tokenSql.markUsed).toHaveBeenCalledWith('1', 'mock-client');
  });

  test('locks the user before re-reading the token', async () => {
    tokenSql.findByTokenHash.mockResolvedValue(boundToken());
    tokenSql.findByTokenHashForUpdate.mockResolvedValue(boundToken());
    userSql.lockUserByIdForUpdate.mockResolvedValue(unverifiedUser);
    userSql.markEmailVerified.mockResolvedValue(verifiedUser);

    await service.verifyToken('a'.repeat(64));

    expect(tokenSql.findByTokenHash.mock.invocationCallOrder[0]).toBeLessThan(
      userSql.lockUserByIdForUpdate.mock.invocationCallOrder[0]
    );
    expect(userSql.lockUserByIdForUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      tokenSql.findByTokenHashForUpdate.mock.invocationCallOrder[0]
    );
  });

  test('looks the token up by hash, never by raw value', async () => {
    tokenSql.findByTokenHash.mockResolvedValue(null);
    const raw = 'b'.repeat(64);

    await service.verifyToken(raw);

    expect(tokenSql.findByTokenHash).toHaveBeenCalledWith(hashToken(raw), 'mock-client');
    expect(tokenSql.findByTokenHash).not.toHaveBeenCalledWith(raw, expect.anything());
  });

  test('rejects a malformed token without querying the database', async () => {
    const result = await service.verifyToken('not-a-token');

    expect(result.outcome).toBe(OUTCOMES.INVALID);
    expect(tokenSql.findByTokenHash).not.toHaveBeenCalled();
  });

  test('rejects an unknown token', async () => {
    tokenSql.findByTokenHash.mockResolvedValue(null);

    const result = await service.verifyToken('c'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.INVALID);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('rejects a token bound to a different email than the current user', async () => {
    tokenSql.findByTokenHash.mockResolvedValue(boundToken());
    tokenSql.findByTokenHashForUpdate.mockResolvedValue(boundToken());
    userSql.lockUserByIdForUpdate.mockResolvedValue({
      ...unverifiedUser,
      email: 'other@example.com',
    });

    const result = await service.verifyToken('a'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.INVALID);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('rejects an expired token', async () => {
    const token = boundToken({ expiresAt: pastDate() });
    tokenSql.findByTokenHash.mockResolvedValue(token);
    tokenSql.findByTokenHashForUpdate.mockResolvedValue(token);
    userSql.lockUserByIdForUpdate.mockResolvedValue(unverifiedUser);

    const result = await service.verifyToken('d'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.EXPIRED);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('rejects a used token', async () => {
    const token = boundToken({ usedAt: new Date() });
    tokenSql.findByTokenHash.mockResolvedValue(token);
    tokenSql.findByTokenHashForUpdate.mockResolvedValue(token);
    userSql.lockUserByIdForUpdate.mockResolvedValue(unverifiedUser);

    const result = await service.verifyToken('e'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.USED);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('rejects a revoked token', async () => {
    const token = boundToken({ revokedAt: new Date() });
    tokenSql.findByTokenHash.mockResolvedValue(token);
    tokenSql.findByTokenHashForUpdate.mockResolvedValue(token);
    userSql.lockUserByIdForUpdate.mockResolvedValue(unverifiedUser);

    const result = await service.verifyToken('f'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.REVOKED);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('is idempotent: replaying a used token on a verified account succeeds', async () => {
    const token = boundToken({ usedAt: new Date() });
    tokenSql.findByTokenHash.mockResolvedValue(token);
    tokenSql.findByTokenHashForUpdate.mockResolvedValue(token);
    userSql.lockUserByIdForUpdate.mockResolvedValue(verifiedUser);

    const result = await service.verifyToken('a'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.ALREADY_VERIFIED);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('an expired token on an already verified account is not an error', async () => {
    const token = boundToken({ expiresAt: pastDate() });
    tokenSql.findByTokenHash.mockResolvedValue(token);
    tokenSql.findByTokenHashForUpdate.mockResolvedValue(token);
    userSql.lockUserByIdForUpdate.mockResolvedValue(verifiedUser);

    const result = await service.verifyToken('a'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.ALREADY_VERIFIED);
  });

  test('rejects a token whose user no longer exists', async () => {
    tokenSql.findByTokenHash.mockResolvedValue(boundToken());
    userSql.lockUserByIdForUpdate.mockResolvedValue(null);

    const result = await service.verifyToken('a'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.INVALID);
  });
});

describe('emailVerificationService.resendVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenSql.insertToken.mockResolvedValue({ id: '2' });
    tokenSql.findActiveForUser.mockResolvedValue(boundToken());
    userSql.lockUserByIdForUpdate.mockResolvedValue(unverifiedUser);
    securityEmail.sendEmailVerificationEmail.mockResolvedValue({ sent: true });
  });

  test('issues a fresh token and invalidates the previous one after delivery', async () => {
    tokenSql.findLatestForUser.mockResolvedValue({
      id: '1',
      createdAt: pastDate(10 * 60 * 1000),
    });

    const result = await service.resendVerification(unverifiedUser);

    expect(result.status).toBe('sent');
    expect(securityEmail.sendEmailVerificationEmail).toHaveBeenCalled();
    expect(tokenSql.revokeActiveForUser).toHaveBeenCalledWith('5', 'mock-client');
    expect(tokenSql.insertToken).toHaveBeenCalledTimes(1);
  });

  test('throttles a resend inside the cooldown window', async () => {
    tokenSql.findLatestForUser.mockResolvedValue({ id: '1', createdAt: new Date() });

    const result = await service.resendVerification(unverifiedUser);

    expect(result.status).toBe('throttled');
    expect(tokenSql.insertToken).not.toHaveBeenCalled();
  });

  test('does not resend for an already verified account', async () => {
    const result = await service.resendVerification(verifiedUser);

    expect(result.status).toBe('already_verified');
    expect(tokenSql.insertToken).not.toHaveBeenCalled();
  });
});
