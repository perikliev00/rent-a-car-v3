// Call jest.mock to perform this step.
jest.mock('../../../src/config/env', () => ({
  // Provide the config field value.
  config: {
    // Provide the frontend base url field value.
    frontendBaseUrl: 'http://localhost:5173',
    // Provide the is prod field value.
    isProd: false,
  },
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/userSqlService', () => ({
  // Provide the find user by id field value.
  findUserById: jest.fn(),
  // Provide the find user by verification token hash field value.
  findUserByVerificationTokenHash: jest.fn(),
  // Provide the set verification token field value.
  setVerificationToken: jest.fn(),
  // Provide the mark email verified field value.
  markEmailVerified: jest.fn(),
  // Provide the clear verification token field value.
  clearVerificationToken: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/email/emailService', () => ({
  // Provide the send mail field value.
  sendMail: jest.fn().mockResolvedValue({ sent: false, reason: 'smtp_not_configured' }),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/account/accountClaimService', () => ({
  // Provide the claim reservations for user field value.
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 1, orders: 1 }),
}));

// Require the '../../../src/services/sql/userSqlService' module as userSql.
const userSql = require('../../../src/services/sql/userSqlService');
// Destructure object properties into local variables.
const { sendMail } = require('../../../src/services/email/emailService');
// Destructure object properties into local variables.
const { claimReservationsForUser } = require('../../../src/services/account/accountClaimService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  hashEmailVerificationToken,
  // Contribute this line to the enclosing declaration or statement.
  sendVerificationEmail,
  // Contribute this line to the enclosing declaration or statement.
  resendVerificationEmail,
  // Contribute this line to the enclosing declaration or statement.
  verifyEmailToken,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/auth/emailVerificationService');

// Declare a test suite grouping related cases.
describe('emailVerificationService', () => {
  // Create the unverified user constant.
  const unverifiedUser = {
    // Provide the id field value.
    id: '11',
    // Provide the email field value.
    email: 'new@example.com',
    // Provide the email verified at field value.
    emailVerifiedAt: null,
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call userSql.setVerificationToken.mockResolvedValue to perform this step.
    userSql.setVerificationToken.mockResolvedValue(unverifiedUser);
    // Call userSql.markEmailVerified.mockImplementation to perform this step.
    userSql.markEmailVerified.mockImplementation(async (id) => ({
      // Provide the id field value.
      id: String(id),
      // Provide the email field value.
      email: 'new@example.com',
      // Provide the email verified at field value.
      emailVerifiedAt: new Date(),
    }));
  });

  // Define a single test case and its expectations.
  test('sendVerificationEmail stores a hashed token and sends mail', async () => {
    // Wait until the asynchronous operation resolves.
    await sendVerificationEmail(unverifiedUser);

    // Assert that the value matches the intended expectation.
    expect(userSql.setVerificationToken).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      '11',
      // Call expect.any to perform this step.
      expect.any(String),
      // Call expect.any to perform this step.
      expect.any(Date)
    );
    // Create the stored hash constant.
    const storedHash = userSql.setVerificationToken.mock.calls[0][1];
    // Assert that the value matches the intended expectation.
    expect(storedHash).toHaveLength(64);
    // Assert that the value matches the intended expectation.
    expect(sendMail).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the to field value.
        to: 'new@example.com',
        // Provide the subject field value.
        subject: 'Verify your LuxRide email',
      })
    );
    // Create the text constant.
    const text = sendMail.mock.calls[0][0].text;
    // Assert that the value matches the intended expectation.
    expect(text).toContain('http://localhost:5173/verify-email?token=');
  });

  // Define a single test case and its expectations.
  test('resendVerificationEmail rejects already verified users', async () => {
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue({
      // Spread unverifiedUser into the surrounding structure.
      ...unverifiedUser,
      // Provide the email verified at field value.
      emailVerifiedAt: new Date(),
    });

    // Wait until the asynchronous operation resolves.
    await expect(resendVerificationEmail(11)).rejects.toMatchObject({
      // Provide the code field value.
      code: 'EMAIL_ALREADY_VERIFIED',
      // Provide the status field value.
      status: 409,
    });
    // Assert that the value matches the intended expectation.
    expect(userSql.setVerificationToken).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('verifyEmailToken rejects unknown tokens', async () => {
    // Call userSql.findUserByVerificationTokenHash.mockResolvedValue to perform this step.
    userSql.findUserByVerificationTokenHash.mockResolvedValue(null);

    // Wait until the asynchronous operation resolves.
    await expect(verifyEmailToken('a'.repeat(64))).rejects.toMatchObject({
      // Provide the code field value.
      code: 'INVALID_TOKEN',
      // Provide the status field value.
      status: 400,
    });
    // Assert that the value matches the intended expectation.
    expect(claimReservationsForUser).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('verifyEmailToken rejects expired tokens', async () => {
    // Create the token constant.
    const token = 'b'.repeat(64);
    // Call userSql.findUserByVerificationTokenHash.mockResolvedValue to perform this step.
    userSql.findUserByVerificationTokenHash.mockResolvedValue({
      // Spread unverifiedUser into the surrounding structure.
      ...unverifiedUser,
      // Provide the email verification token hash field value.
      emailVerificationTokenHash: hashEmailVerificationToken(token),
      // Provide the email verification expires at field value.
      emailVerificationExpiresAt: new Date(Date.now() - 60_000),
    });

    // Wait until the asynchronous operation resolves.
    await expect(verifyEmailToken(token)).rejects.toMatchObject({
      // Provide the code field value.
      code: 'TOKEN_EXPIRED',
      // Provide the status field value.
      status: 400,
    });
    // Assert that the value matches the intended expectation.
    expect(userSql.clearVerificationToken).toHaveBeenCalledWith('11');
    // Assert that the value matches the intended expectation.
    expect(claimReservationsForUser).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('verifyEmailToken marks verified and claims bookings', async () => {
    // Create the token constant.
    const token = 'c'.repeat(64);
    // Call userSql.findUserByVerificationTokenHash.mockResolvedValue to perform this step.
    userSql.findUserByVerificationTokenHash.mockResolvedValue({
      // Spread unverifiedUser into the surrounding structure.
      ...unverifiedUser,
      // Provide the email verification token hash field value.
      emailVerificationTokenHash: hashEmailVerificationToken(token),
      // Provide the email verification expires at field value.
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
    });

    // Create the verified constant.
    const verified = await verifyEmailToken(token);

    // Assert that the value matches the intended expectation.
    expect(userSql.markEmailVerified).toHaveBeenCalledWith('11');
    // Assert that the value matches the intended expectation.
    expect(claimReservationsForUser).toHaveBeenCalledWith('11', 'new@example.com');
    // Assert that the value matches the intended expectation.
    expect(verified.emailVerifiedAt).toBeInstanceOf(Date);
  });
});
