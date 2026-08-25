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
}));

jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserById: jest.fn(),
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

function futureDate(ms = 60_000) {
  return new Date(Date.now() + ms);
}

function pastDate(ms = 60_000) {
  return new Date(Date.now() - ms);
}

describe('emailVerificationService.issueToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenSql.insertToken.mockResolvedValue({ id: '1' });
  });

  test('stores only a SHA-256 hash, never the raw token', async () => {
    const { rawToken } = await service.issueToken(unverifiedUser);

    const [payload] = tokenSql.insertToken.mock.calls[0];
    expect(payload.tokenHash).toBe(hashToken(rawToken));
    expect(payload.tokenHash).not.toBe(rawToken);
    expect(JSON.stringify(payload)).not.toContain(rawToken);
  });

  test('revokes outstanding tokens before issuing a new one', async () => {
    await service.issueToken(unverifiedUser);

    expect(tokenSql.revokeActiveForUser).toHaveBeenCalledWith('5', 'mock-client');
    const revokeOrder = tokenSql.revokeActiveForUser.mock.invocationCallOrder[0];
    const insertOrder = tokenSql.insertToken.mock.invocationCallOrder[0];
    expect(revokeOrder).toBeLessThan(insertOrder);
  });

  test('sets an expiry in the future', async () => {
    const before = Date.now();
    const { expiresAt } = await service.issueToken(unverifiedUser);

    expect(new Date(expiresAt).getTime()).toBeGreaterThan(before);
    expect(new Date(expiresAt).getTime()).toBeLessThanOrEqual(before + service.TOKEN_TTL_MS + 1000);
  });
});

describe('emailVerificationService.issueAndSendVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenSql.insertToken.mockResolvedValue({ id: '1' });
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

  test('reports an undelivered mail without throwing', async () => {
    securityEmail.sendEmailVerificationEmail.mockResolvedValue({
      sent: false,
      reason: 'smtp_not_configured',
    });

    const result = await service.issueAndSendVerification(unverifiedUser);

    expect(result.sent).toBe(false);
  });
});

describe('emailVerificationService.verifyToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('verifies the account for a valid token', async () => {
    tokenSql.findByTokenHashForUpdate.mockResolvedValue({
      id: '1',
      userId: '5',
      expiresAt: futureDate(),
      usedAt: null,
      revokedAt: null,
    });
    userSql.findUserById.mockResolvedValue(unverifiedUser);
    userSql.markEmailVerified.mockResolvedValue(verifiedUser);

    const result = await service.verifyToken('a'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.VERIFIED);
    expect(userSql.markEmailVerified).toHaveBeenCalledWith('5', 'mock-client');
    expect(tokenSql.markUsed).toHaveBeenCalledWith('1', 'mock-client');
  });

  test('looks the token up by hash, never by raw value', async () => {
    tokenSql.findByTokenHashForUpdate.mockResolvedValue(null);
    const raw = 'b'.repeat(64);

    await service.verifyToken(raw);

    expect(tokenSql.findByTokenHashForUpdate).toHaveBeenCalledWith(hashToken(raw), 'mock-client');
    expect(tokenSql.findByTokenHashForUpdate).not.toHaveBeenCalledWith(raw, expect.anything());
  });

  test('rejects a malformed token without querying the database', async () => {
    const result = await service.verifyToken('not-a-token');

    expect(result.outcome).toBe(OUTCOMES.INVALID);
    expect(tokenSql.findByTokenHashForUpdate).not.toHaveBeenCalled();
  });

  test('rejects an unknown token', async () => {
    tokenSql.findByTokenHashForUpdate.mockResolvedValue(null);

    const result = await service.verifyToken('c'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.INVALID);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('rejects an expired token', async () => {
    tokenSql.findByTokenHashForUpdate.mockResolvedValue({
      id: '1',
      userId: '5',
      expiresAt: pastDate(),
      usedAt: null,
      revokedAt: null,
    });
    userSql.findUserById.mockResolvedValue(unverifiedUser);

    const result = await service.verifyToken('d'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.EXPIRED);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('rejects a used token', async () => {
    tokenSql.findByTokenHashForUpdate.mockResolvedValue({
      id: '1',
      userId: '5',
      expiresAt: futureDate(),
      usedAt: new Date(),
      revokedAt: null,
    });
    userSql.findUserById.mockResolvedValue(unverifiedUser);

    const result = await service.verifyToken('e'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.USED);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('rejects a revoked token', async () => {
    tokenSql.findByTokenHashForUpdate.mockResolvedValue({
      id: '1',
      userId: '5',
      expiresAt: futureDate(),
      usedAt: null,
      revokedAt: new Date(),
    });
    userSql.findUserById.mockResolvedValue(unverifiedUser);

    const result = await service.verifyToken('f'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.REVOKED);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('is idempotent: replaying a used token on a verified account succeeds', async () => {
    tokenSql.findByTokenHashForUpdate.mockResolvedValue({
      id: '1',
      userId: '5',
      expiresAt: futureDate(),
      usedAt: new Date(),
      revokedAt: null,
    });
    userSql.findUserById.mockResolvedValue(verifiedUser);

    const result = await service.verifyToken('a'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.ALREADY_VERIFIED);
    expect(userSql.markEmailVerified).not.toHaveBeenCalled();
  });

  test('an expired token on an already verified account is not an error', async () => {
    tokenSql.findByTokenHashForUpdate.mockResolvedValue({
      id: '1',
      userId: '5',
      expiresAt: pastDate(),
      usedAt: null,
      revokedAt: null,
    });
    userSql.findUserById.mockResolvedValue(verifiedUser);

    const result = await service.verifyToken('a'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.ALREADY_VERIFIED);
  });

  test('rejects a token whose user no longer exists', async () => {
    tokenSql.findByTokenHashForUpdate.mockResolvedValue({
      id: '1',
      userId: '5',
      expiresAt: futureDate(),
      usedAt: null,
      revokedAt: null,
    });
    userSql.findUserById.mockResolvedValue(null);

    const result = await service.verifyToken('a'.repeat(64));

    expect(result.outcome).toBe(OUTCOMES.INVALID);
  });
});

describe('emailVerificationService.resendVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenSql.insertToken.mockResolvedValue({ id: '2' });
    securityEmail.sendEmailVerificationEmail.mockResolvedValue({ sent: true });
  });

  test('issues a fresh token and invalidates the previous one', async () => {
    tokenSql.findLatestForUser.mockResolvedValue({
      id: '1',
      createdAt: pastDate(10 * 60 * 1000),
    });

    const result = await service.resendVerification(unverifiedUser);

    expect(result.status).toBe('sent');
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
