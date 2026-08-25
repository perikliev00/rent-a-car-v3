jest.mock('../../../src/db/transaction', () => ({
  runWithTransaction: jest.fn((fn) => fn('mock-client')),
  clientQuery: jest.fn(),
}));

jest.mock('../../../src/services/sql/reservationClaimTokenSqlService', () => ({
  revokeActiveForReservation: jest.fn().mockResolvedValue(0),
  insertToken: jest.fn(),
  findByTokenHash: jest.fn(),
  findByTokenHashForUpdate: jest.fn(),
  markUsed: jest.fn().mockResolvedValue(1),
  findLatestForReservation: jest.fn(),
}));

jest.mock('../../../src/services/sql/reservationSqlService', () => ({
  findById: jest.fn(),
  lockOwnershipForClaim: jest.fn(),
  assignOwnerIfUnclaimed: jest.fn().mockResolvedValue(1),
}));

jest.mock('../../../src/services/sql/orderSqlService', () => ({
  assignOwnerByReservationIdIfUnclaimed: jest.fn().mockResolvedValue(1),
}));

jest.mock('../../../src/services/sql/adminAuditSqlService', () => ({
  insertAuditLog: jest.fn().mockResolvedValue({ id: 1 }),
}));

jest.mock('../../../src/services/email/securityEmailService', () => ({
  sendReservationClaimEmail: jest.fn().mockResolvedValue({ sent: true }),
  sendReservationClaimedNotice: jest.fn().mockResolvedValue({ sent: true }),
}));

const claimTokenSql = require('../../../src/services/sql/reservationClaimTokenSqlService');
const reservationSql = require('../../../src/services/sql/reservationSqlService');
const orderSql = require('../../../src/services/sql/orderSqlService');
const auditSql = require('../../../src/services/sql/adminAuditSqlService');
const securityEmail = require('../../../src/services/email/securityEmailService');
const { hashToken } = require('../../../src/services/auth/tokenUtils');
const service = require('../../../src/services/account/reservationClaimService');

const { OUTCOMES } = service;

const RAW_TOKEN = 'a'.repeat(64);

const verifiedUser = {
  id: '7',
  email: 'guest@example.com',
  emailVerified: true,
};

function activeToken(overrides = {}) {
  return {
    id: '1',
    reservationId: '10',
    bookingEmail: 'guest@example.com',
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    revokedAt: null,
    usedByUserId: null,
    ...overrides,
  };
}

function unownedReservation(overrides = {}) {
  return { id: '10', userId: null, email: 'guest@example.com', status: 'confirmed', ...overrides };
}

describe('reservationClaimService.issueClaimToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claimTokenSql.insertToken.mockResolvedValue({ id: '1' });
  });

  test('stores only the hash and binds the token to one reservation and email', async () => {
    const issued = await service.issueClaimToken({
      reservationId: '10',
      bookingEmail: 'Guest@Example.com',
    });

    const [payload] = claimTokenSql.insertToken.mock.calls[0];
    expect(payload.tokenHash).toBe(hashToken(issued.rawToken));
    expect(payload.tokenHash).not.toBe(issued.rawToken);
    expect(payload.reservationId).toBe('10');
    expect(payload.bookingEmail).toBe('guest@example.com');
    expect(JSON.stringify(payload)).not.toContain(issued.rawToken);
  });

  test('revokes any outstanding token for that reservation first', async () => {
    await service.issueClaimToken({ reservationId: '10', bookingEmail: 'guest@example.com' });

    expect(claimTokenSql.revokeActiveForReservation).toHaveBeenCalledWith('10', 'mock-client');
    expect(
      claimTokenSql.revokeActiveForReservation.mock.invocationCallOrder[0],
    ).toBeLessThan(claimTokenSql.insertToken.mock.invocationCallOrder[0]);
  });
});

describe('reservationClaimService.claimReservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claimTokenSql.markUsed.mockResolvedValue(1);
    reservationSql.assignOwnerIfUnclaimed.mockResolvedValue(1);
    orderSql.assignOwnerByReservationIdIfUnclaimed.mockResolvedValue(1);
  });

  test('links the reservation and its order in one transaction', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(activeToken());
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.CLAIMED);
    expect(reservationSql.assignOwnerIfUnclaimed).toHaveBeenCalledWith(10, 7, 'mock-client');
    expect(orderSql.assignOwnerByReservationIdIfUnclaimed).toHaveBeenCalledWith(
      10,
      7,
      'mock-client',
    );
    expect(claimTokenSql.markUsed).toHaveBeenCalledWith('1', 7, 'mock-client');
  });

  test('locks the token before the reservation', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(activeToken());
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());

    await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(claimTokenSql.findByTokenHashForUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      reservationSql.lockOwnershipForClaim.mock.invocationCallOrder[0],
    );
  });

  test('looks the token up by hash, never by raw value', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(null);

    await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(claimTokenSql.findByTokenHashForUpdate).toHaveBeenCalledWith(
      hashToken(RAW_TOKEN),
      'mock-client',
    );
  });

  test('refuses an unverified account without touching ownership', async () => {
    const result = await service.claimReservation({
      user: { ...verifiedUser, emailVerified: false },
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.EMAIL_MISMATCH);
    expect(claimTokenSql.findByTokenHashForUpdate).not.toHaveBeenCalled();
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('refuses a malformed token without touching the database', async () => {
    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: 'nope',
    });

    expect(result.outcome).toBe(OUTCOMES.INVALID_TOKEN);
    expect(claimTokenSql.findByTokenHashForUpdate).not.toHaveBeenCalled();
  });

  test('refuses a token issued for a different email', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(
      activeToken({ bookingEmail: 'someone.else@example.com' }),
    );
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.EMAIL_MISMATCH);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('normalizes email comparison case-insensitively', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(
      activeToken({ bookingEmail: 'Guest@Example.COM' }),
    );
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());

    const result = await service.claimReservation({
      user: { ...verifiedUser, email: 'GUEST@example.com' },
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.CLAIMED);
  });

  test('refuses a token issued for a different reservation', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(
      activeToken({ reservationId: '99' }),
    );

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.INVALID_TOKEN);
    expect(reservationSql.lockOwnershipForClaim).not.toHaveBeenCalled();
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('refuses an expired token', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(
      activeToken({ expiresAt: new Date(Date.now() - 1000) }),
    );

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.EXPIRED);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('refuses a revoked token', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(
      activeToken({ revokedAt: new Date() }),
    );

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.INVALID_TOKEN);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('refuses a used token in a second account\u2019s hands', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(
      activeToken({ usedAt: new Date(), usedByUserId: '99' }),
    );
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.INVALID_TOKEN);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('never transfers a reservation already owned by someone else', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(activeToken());
    reservationSql.lockOwnershipForClaim.mockResolvedValue(
      unownedReservation({ userId: '99' }),
    );

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.CONFLICT);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
    expect(orderSql.assignOwnerByReservationIdIfUnclaimed).not.toHaveBeenCalled();
  });

  test('is idempotent when the rightful owner replays a used token', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(
      activeToken({ usedAt: new Date(), usedByUserId: '7' }),
    );
    reservationSql.lockOwnershipForClaim.mockResolvedValue(
      unownedReservation({ userId: '7' }),
    );

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.ALREADY_OWNED);
    expect(claimTokenSql.markUsed).not.toHaveBeenCalled();
  });

  test('reports a conflict when a parallel claim wins the ownership update', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(activeToken());
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());
    // The conditional UPDATE matched nothing, meaning another transaction took ownership.
    reservationSql.assignOwnerIfUnclaimed.mockResolvedValue(0);

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.CONFLICT);
    expect(orderSql.assignOwnerByReservationIdIfUnclaimed).not.toHaveBeenCalled();
    expect(claimTokenSql.markUsed).not.toHaveBeenCalled();
  });

  test('refuses a token for a reservation that no longer exists', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(activeToken());
    reservationSql.lockOwnershipForClaim.mockResolvedValue(null);

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.INVALID_TOKEN);
  });

  test('audits the claim without the raw token or booking PII', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(activeToken());
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());

    await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    const [entry] = auditSql.insertAuditLog.mock.calls[0];
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain(RAW_TOKEN);
    expect(serialized).not.toContain(hashToken(RAW_TOKEN));
    expect(serialized).not.toContain('guest@example.com');
    expect(entry.entityId).toBe('10');
    expect(entry.metadata).toEqual({ outcome: OUTCOMES.CLAIMED });
  });

  test('audits rejected attempts too', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(null);

    await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(auditSql.insertAuditLog).toHaveBeenCalledTimes(1);
    expect(auditSql.insertAuditLog.mock.calls[0][0].metadata).toEqual({
      outcome: OUTCOMES.INVALID_TOKEN,
    });
  });

  test('a failed security notice does not undo a committed claim', async () => {
    claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(activeToken());
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());
    securityEmail.sendReservationClaimedNotice.mockRejectedValue(new Error('smtp down'));

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.CLAIMED);
  });
});

describe('reservationClaimService.requestClaimToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claimTokenSql.insertToken.mockResolvedValue({ id: '1' });
  });

  test('mails a link only to the email stored on the booking', async () => {
    reservationSql.findById.mockResolvedValue({
      id: '10',
      email: 'guest@example.com',
      userId: undefined,
    });

    const result = await service.requestClaimToken({
      user: verifiedUser,
      reservationId: '10',
      bookingEmail: 'guest@example.com',
    });

    expect(result.status).toBe('sent');
    expect(securityEmail.sendReservationClaimEmail.mock.calls[0][0].to).toBe(
      'guest@example.com',
    );
  });

  test('ignores a request for a booking made with a different email', async () => {
    reservationSql.findById.mockResolvedValue({
      id: '10',
      email: 'someone.else@example.com',
      userId: undefined,
    });

    const result = await service.requestClaimToken({
      user: verifiedUser,
      reservationId: '10',
      bookingEmail: 'guest@example.com',
    });

    expect(result.status).toBe('ignored');
    expect(securityEmail.sendReservationClaimEmail).not.toHaveBeenCalled();
  });

  test('ignores a request for an email other than the caller\u2019s own', async () => {
    const result = await service.requestClaimToken({
      user: verifiedUser,
      reservationId: '10',
      bookingEmail: 'victim@example.com',
    });

    expect(result.status).toBe('ignored');
    expect(reservationSql.findById).not.toHaveBeenCalled();
    expect(securityEmail.sendReservationClaimEmail).not.toHaveBeenCalled();
  });

  test('ignores a request from an unverified account', async () => {
    const result = await service.requestClaimToken({
      user: { ...verifiedUser, emailVerified: false },
      reservationId: '10',
      bookingEmail: 'guest@example.com',
    });

    expect(result.status).toBe('ignored');
    expect(reservationSql.findById).not.toHaveBeenCalled();
  });

  test('ignores a request for a booking owned by another account', async () => {
    reservationSql.findById.mockResolvedValue({
      id: '10',
      email: 'guest@example.com',
      userId: '99',
    });

    const result = await service.requestClaimToken({
      user: verifiedUser,
      reservationId: '10',
      bookingEmail: 'guest@example.com',
    });

    expect(result.status).toBe('ignored');
    expect(securityEmail.sendReservationClaimEmail).not.toHaveBeenCalled();
  });

  test('ignores a request for a reservation that does not exist', async () => {
    reservationSql.findById.mockResolvedValue(null);

    const result = await service.requestClaimToken({
      user: verifiedUser,
      reservationId: '4242',
      bookingEmail: 'guest@example.com',
    });

    expect(result.status).toBe('ignored');
  });
});
