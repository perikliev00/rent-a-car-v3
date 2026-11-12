// Create the original env constant.
const originalEnv = process.env;

// Declare a test suite grouping related cases.
describe('emailService', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.resetModules to perform this step.
    jest.resetModules();
    // Update process.env with the right-hand side value.
    process.env = { ...originalEnv };
  });

  // Register cleanup that runs after the tests.
  afterAll(() => {
    // Update process.env with the right-hand side value.
    process.env = originalEnv;
  });

  // Define a single test case and its expectations.
  test('sendMail skips when SMTP is not configured', async () => {
    // Delete the specified property from the object.
    delete process.env.SMTP_HOST;
    // Delete the specified property from the object.
    delete process.env.SMTP_USER;
    // Delete the specified property from the object.
    delete process.env.SMTP_PASS;
    // Delete the specified property from the object.
    delete process.env.MAIL_FROM;

    // Destructure object properties into local variables.
    const { sendMail } = require('../../../src/services/email/emailService');
    // Create the result constant.
    const result = await sendMail({
      // Provide the to field value.
      to: 'user@example.com',
      // Provide the subject field value.
      subject: 'Test',
      // Provide the text field value.
      text: 'Hello',
    });

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ sent: false, reason: 'smtp_not_configured' });
  });

  // Define a single test case and its expectations.
  test('sendMail returns missing recipient reason', async () => {
    // Destructure object properties into local variables.
    const { sendMail } = require('../../../src/services/email/emailService');
    // Create the result constant.
    const result = await sendMail({ subject: 'Test', text: 'Hello' });

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ sent: false, reason: 'missing_recipient' });
  });
});
