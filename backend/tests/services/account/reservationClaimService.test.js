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
  findActiveForReservation: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../src/services/sql/reservationSqlService', () => ({
  findById: jest.fn(),
  lockOwnershipForClaim: jest.fn(),
  assignOwnerIfUnclaimed: jest.fn().mockResolvedValue(1),
}));

jest.mock('../../../src/services/sql/orderSqlService', () => ({
  assignOwnerByReservationIdIfUnclaimed: jest.fn().mockResolvedValue(1),
  lockByReservationIdForUpdate: jest.fn(),
}));

jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserById: jest.fn(),
  lockUserByIdForUpdate: jest.fn(),
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
const userSql = require('../../../src/services/sql/userSqlService');
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

function unownedOrder(overrides = {}) {
  return { id: '20', userId: null, reservationId: '10', ...overrides };
}

function mockSuccessfulClaimLookups({
  token = activeToken(),
  reservation = unownedReservation(),
  order = unownedOrder(),
  dbUser = verifiedUser,
} = {}) {
  claimTokenSql.findByTokenHash.mockResolvedValue(token);
  claimTokenSql.findByTokenHashForUpdate.mockResolvedValue(token);
  userSql.lockUserByIdForUpdate.mockResolvedValue(dbUser);
  reservationSql.lockOwnershipForClaim.mockResolvedValue(reservation);
  orderSql.lockByReservationIdForUpdate.mockResolvedValue(order);
}

describe('reservationClaimService.issueClaimToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claimTokenSql.insertToken.mockResolvedValue({ id: '1' });
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());
  });

  test('stores only the hash and binds the token to the reservation email from the database', async () => {
    reservationSql.lockOwnershipForClaim.mockResolvedValue(
      unownedReservation({ email: 'Guest@Example.com' })
    );

    const issued = await service.issueClaimToken({ reservationId: '10' });

    const [payload] = claimTokenSql.insertToken.mock.calls[0];
    expect(payload.tokenHash).toBe(hashToken(issued.rawToken));
    expect(payload.tokenHash).not.toBe(issued.rawToken);
    expect(payload.reservationId).toBe('10');
    expect(payload.bookingEmail).toBe('guest@example.com');
    expect(JSON.stringify(payload)).not.toContain(issued.rawToken);
    expect(issued.bookingEmail).toBe('guest@example.com');
  });

  test('ignores a caller-supplied bookingEmail', async () => {
    await service.issueClaimToken({
      reservationId: '10',
      bookingEmail: 'attacker@example.com',
    });

    const [payload] = claimTokenSql.insertToken.mock.calls[0];
    expect(payload.bookingEmail).toBe('guest@example.com');
  });

  test('locks the reservation then revokes any outstanding token before insert', async () => {
    await service.issueClaimToken({ reservationId: '10' });

    expect(reservationSql.lockOwnershipForClaim).toHaveBeenCalledWith(10, 'mock-client');
    expect(claimTokenSql.revokeActiveForReservation).toHaveBeenCalledWith('10', 'mock-client');
    expect(
      reservationSql.lockOwnershipForClaim.mock.invocationCallOrder[0]
    ).toBeLessThan(claimTokenSql.revokeActiveForReservation.mock.invocationCallOrder[0]);
    expect(
      claimTokenSql.revokeActiveForReservation.mock.invocationCallOrder[0]
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
    mockSuccessfulClaimLookups();

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
      'mock-client'
    );
    expect(claimTokenSql.markUsed).toHaveBeenCalledWith('1', 7, 'mock-client');
  });

  test('locks user, reservation, order, then token', async () => {
    mockSuccessfulClaimLookups();

    await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(claimTokenSql.findByTokenHash.mock.invocationCallOrder[0]).toBeLessThan(
      userSql.lockUserByIdForUpdate.mock.invocationCallOrder[0]
    );
    expect(userSql.lockUserByIdForUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      reservationSql.lockOwnershipForClaim.mock.invocationCallOrder[0]
    );
    expect(reservationSql.lockOwnershipForClaim.mock.invocationCallOrder[0]).toBeLessThan(
      orderSql.lockByReservationIdForUpdate.mock.invocationCallOrder[0]
    );
    expect(orderSql.lockByReservationIdForUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      claimTokenSql.findByTokenHashForUpdate.mock.invocationCallOrder[0]
    );
  });

  test('looks the token up by hash, never by raw value', async () => {
    claimTokenSql.findByTokenHash.mockResolvedValue(null);

    await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(claimTokenSql.findByTokenHash).toHaveBeenCalledWith(
      hashToken(RAW_TOKEN),
      'mock-client'
    );
    expect(claimTokenSql.findByTokenHash).not.toHaveBeenCalledWith(RAW_TOKEN, expect.anything());
  });

  test('authorizes from the locked DB user, not session emailVerified', async () => {
    mockSuccessfulClaimLookups();

    const result = await service.claimReservation({
      user: { ...verifiedUser, emailVerified: false, email: 'stale@example.com' },
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.CLAIMED);
    expect(userSql.lockUserByIdForUpdate).toHaveBeenCalledWith(7, 'mock-client');
  });

  test('refuses an unverified DB account without touching ownership', async () => {
    mockSuccessfulClaimLookups({
      dbUser: { ...verifiedUser, emailVerified: false },
    });

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.EMAIL_MISMATCH);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('refuses a malformed token without touching the database', async () => {
    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: 'nope',
    });

    expect(result.outcome).toBe(OUTCOMES.INVALID_TOKEN);
    expect(claimTokenSql.findByTokenHash).not.toHaveBeenCalled();
  });

  test('refuses a token issued for a different email', async () => {
    mockSuccessfulClaimLookups({
      token: activeToken({ bookingEmail: 'someone.else@example.com' }),
    });

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.EMAIL_MISMATCH);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('refuses when the reservation email no longer matches the token', async () => {
    mockSuccessfulClaimLookups({
      reservation: unownedReservation({ email: 'new-owner@example.com' }),
    });

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.EMAIL_MISMATCH);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('normalizes email comparison case-insensitively', async () => {
    mockSuccessfulClaimLookups({
      token: activeToken({ bookingEmail: 'Guest@Example.COM' }),
      dbUser: { ...verifiedUser, email: 'GUEST@example.com' },
      reservation: unownedReservation({ email: ' guest@EXAMPLE.com ' }),
    });

    const result = await service.claimReservation({
      user: { ...verifiedUser, email: 'stale-session@example.com' },
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.CLAIMED);
  });

  test('refuses a token issued for a different reservation', async () => {
    claimTokenSql.findByTokenHash.mockResolvedValue(activeToken({ reservationId: '99' }));

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.INVALID_TOKEN);
    expect(userSql.lockUserByIdForUpdate).not.toHaveBeenCalled();
    expect(reservationSql.lockOwnershipForClaim).not.toHaveBeenCalled();
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('refuses an expired token', async () => {
    mockSuccessfulClaimLookups({
      token: activeToken({ expiresAt: new Date(Date.now() - 1000) }),
    });

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.EXPIRED);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('refuses a revoked token', async () => {
    mockSuccessfulClaimLookups({
      token: activeToken({ revokedAt: new Date() }),
    });

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.INVALID_TOKEN);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('refuses a used token in a second account’s hands', async () => {
    mockSuccessfulClaimLookups({
      token: activeToken({ usedAt: new Date(), usedByUserId: '99' }),
    });

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.INVALID_TOKEN);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('never transfers a reservation already owned by someone else', async () => {
    mockSuccessfulClaimLookups({
      reservation: unownedReservation({ userId: '99' }),
    });

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.CONFLICT);
    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
    expect(orderSql.assignOwnerByReservationIdIfUnclaimed).not.toHaveBeenCalled();
  });

  test('never transfers an order already owned by someone else', async () => {
    mockSuccessfulClaimLookups({
      order: unownedOrder({ userId: '99' }),
    });

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
    mockSuccessfulClaimLookups({
      token: activeToken({ usedAt: new Date(), usedByUserId: '7' }),
      reservation: unownedReservation({ userId: '7' }),
      order: unownedOrder({ userId: '7' }),
    });

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.ALREADY_OWNED);
    expect(claimTokenSql.markUsed).not.toHaveBeenCalled();
  });

  test('throws and does not return conflict after a zero-row reservation write', async () => {
    mockSuccessfulClaimLookups();
    reservationSql.assignOwnerIfUnclaimed.mockResolvedValue(0);

    await expect(
      service.claimReservation({
        user: verifiedUser,
        reservationId: '10',
        rawToken: RAW_TOKEN,
      })
    ).rejects.toMatchObject({ code: 'CLAIM_INTEGRITY_ERROR', status: 500 });

    expect(orderSql.assignOwnerByReservationIdIfUnclaimed).not.toHaveBeenCalled();
    expect(claimTokenSql.markUsed).not.toHaveBeenCalled();
  });

  test('throws and rolls back when the order update matches zero rows', async () => {
    mockSuccessfulClaimLookups();
    orderSql.assignOwnerByReservationIdIfUnclaimed.mockResolvedValue(0);

    await expect(
      service.claimReservation({
        user: verifiedUser,
        reservationId: '10',
        rawToken: RAW_TOKEN,
      })
    ).rejects.toMatchObject({ code: 'CLAIM_INTEGRITY_ERROR' });

    expect(reservationSql.assignOwnerIfUnclaimed).toHaveBeenCalled();
    expect(claimTokenSql.markUsed).not.toHaveBeenCalled();
  });

  test('throws and rolls back when token consumption matches zero rows', async () => {
    mockSuccessfulClaimLookups();
    claimTokenSql.markUsed.mockResolvedValue(0);

    await expect(
      service.claimReservation({
        user: verifiedUser,
        reservationId: '10',
        rawToken: RAW_TOKEN,
      })
    ).rejects.toMatchObject({ code: 'CLAIM_INTEGRITY_ERROR' });
  });

  test('allows a hold with no order', async () => {
    mockSuccessfulClaimLookups({
      reservation: unownedReservation({ status: 'pending_payment' }),
      order: null,
    });

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.CLAIMED);
    expect(orderSql.assignOwnerByReservationIdIfUnclaimed).not.toHaveBeenCalled();
    expect(claimTokenSql.markUsed).toHaveBeenCalled();
  });

  test('fails closed when a confirmed reservation is missing its order', async () => {
    mockSuccessfulClaimLookups({ order: null });

    await expect(
      service.claimReservation({
        user: verifiedUser,
        reservationId: '10',
        rawToken: RAW_TOKEN,
      })
    ).rejects.toMatchObject({ code: 'CLAIM_INTEGRITY_ERROR' });

    expect(reservationSql.assignOwnerIfUnclaimed).not.toHaveBeenCalled();
  });

  test('refuses a token for a reservation that no longer exists', async () => {
    mockSuccessfulClaimLookups({ reservation: null });

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.INVALID_TOKEN);
  });

  test('audits the claim without the raw token or booking PII', async () => {
    mockSuccessfulClaimLookups();

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
    claimTokenSql.findByTokenHash.mockResolvedValue(null);

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
    mockSuccessfulClaimLookups();
    securityEmail.sendReservationClaimedNotice.mockRejectedValue(new Error('smtp down'));

    const result = await service.claimReservation({
      user: verifiedUser,
      reservationId: '10',
      rawToken: RAW_TOKEN,
    });

    expect(result.outcome).toBe(OUTCOMES.CLAIMED);
  });
});

describe('reservationClaimService.issueAndSendClaimToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claimTokenSql.insertToken.mockResolvedValue({ id: '1' });
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());
    claimTokenSql.findActiveForReservation.mockResolvedValue(null);
  });

  test('does not rotate an existing token when delivery fails', async () => {
    claimTokenSql.findActiveForReservation.mockResolvedValue(activeToken());
    reservationSql.findById.mockResolvedValue(unownedReservation());
    securityEmail.sendReservationClaimEmail.mockResolvedValue({
      sent: false,
      reason: 'smtp_not_configured',
    });

    const result = await service.issueAndSendClaimToken({ reservationId: '10' });

    expect(result.sent).toBe(false);
    expect(claimTokenSql.revokeActiveForReservation).not.toHaveBeenCalled();
    expect(claimTokenSql.insertToken).not.toHaveBeenCalled();
  });
});

describe('reservationClaimService.requestClaimToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claimTokenSql.insertToken.mockResolvedValue({ id: '1' });
    userSql.findUserById.mockResolvedValue(verifiedUser);
    reservationSql.lockOwnershipForClaim.mockResolvedValue(unownedReservation());
    claimTokenSql.findActiveForReservation.mockResolvedValue(null);
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
      'guest@example.com'
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

  test('ignores a request for an email other than the caller’s own', async () => {
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
    userSql.findUserById.mockResolvedValue({ ...verifiedUser, emailVerified: false });

    const result = await service.requestClaimToken({
      user: verifiedUser,
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
