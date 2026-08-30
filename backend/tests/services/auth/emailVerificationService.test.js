jest.mock('../../../src/config/env', () => ({
  config: {
    frontendBaseUrl: 'http://localhost:5173',
    isProd: false,
  },
}));
jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserById: jest.fn(),
  findUserByVerificationTokenHash: jest.fn(),
  setVerificationToken: jest.fn(),
  markEmailVerified: jest.fn(),
  clearVerificationToken: jest.fn(),
}));
jest.mock('../../../src/services/email/emailService', () => ({
  sendMail: jest.fn().mockResolvedValue({ sent: false, reason: 'smtp_not_configured' }),
}));
jest.mock('../../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 1, orders: 1 }),
}));

const userSql = require('../../../src/services/sql/userSqlService');
const { sendMail } = require('../../../src/services/email/emailService');
const { claimReservationsForUser } = require('../../../src/services/account/accountClaimService');
const {
  hashEmailVerificationToken,
  sendVerificationEmail,
  resendVerificationEmail,
  verifyEmailToken,
} = require('../../../src/services/auth/emailVerificationService');

describe('emailVerificationService', () => {
  const unverifiedUser = {
    id: '11',
    email: 'new@example.com',
    emailVerifiedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userSql.setVerificationToken.mockResolvedValue(unverifiedUser);
    userSql.markEmailVerified.mockImplementation(async (id) => ({
      id: String(id),
      email: 'new@example.com',
      emailVerifiedAt: new Date(),
    }));
  });

  test('sendVerificationEmail stores a hashed token and sends mail', async () => {
    await sendVerificationEmail(unverifiedUser);

    expect(userSql.setVerificationToken).toHaveBeenCalledWith(
      '11',
      expect.any(String),
      expect.any(Date)
    );
    const storedHash = userSql.setVerificationToken.mock.calls[0][1];
    expect(storedHash).toHaveLength(64);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        subject: 'Verify your LuxRide email',
      })
    );
    const text = sendMail.mock.calls[0][0].text;
    expect(text).toContain('http://localhost:5173/verify-email?token=');
  });

  test('resendVerificationEmail rejects already verified users', async () => {
    userSql.findUserById.mockResolvedValue({
      ...unverifiedUser,
      emailVerifiedAt: new Date(),
    });

    await expect(resendVerificationEmail(11)).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_VERIFIED',
      status: 409,
    });
    expect(userSql.setVerificationToken).not.toHaveBeenCalled();
  });

  test('verifyEmailToken rejects unknown tokens', async () => {
    userSql.findUserByVerificationTokenHash.mockResolvedValue(null);

    await expect(verifyEmailToken('a'.repeat(64))).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      status: 400,
    });
    expect(claimReservationsForUser).not.toHaveBeenCalled();
  });

  test('verifyEmailToken rejects expired tokens', async () => {
    const token = 'b'.repeat(64);
    userSql.findUserByVerificationTokenHash.mockResolvedValue({
      ...unverifiedUser,
      emailVerificationTokenHash: hashEmailVerificationToken(token),
      emailVerificationExpiresAt: new Date(Date.now() - 60_000),
    });

    await expect(verifyEmailToken(token)).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
      status: 400,
    });
    expect(userSql.clearVerificationToken).toHaveBeenCalledWith('11');
    expect(claimReservationsForUser).not.toHaveBeenCalled();
  });

  test('verifyEmailToken marks verified and claims bookings', async () => {
    const token = 'c'.repeat(64);
    userSql.findUserByVerificationTokenHash.mockResolvedValue({
      ...unverifiedUser,
      emailVerificationTokenHash: hashEmailVerificationToken(token),
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
    });

    const verified = await verifyEmailToken(token);

    expect(userSql.markEmailVerified).toHaveBeenCalledWith('11');
    expect(claimReservationsForUser).toHaveBeenCalledWith('11', 'new@example.com');
    expect(verified.emailVerifiedAt).toBeInstanceOf(Date);
  });
});
