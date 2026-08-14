const originalEnv = process.env;

describe('emailService', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('sendMail skips when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.MAIL_FROM;

    const { sendMail } = require('../../../src/services/email/emailService');
    const result = await sendMail({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result).toEqual({ sent: false, reason: 'smtp_not_configured' });
  });

  test('sendMail returns missing recipient reason', async () => {
    const { sendMail } = require('../../../src/services/email/emailService');
    const result = await sendMail({ subject: 'Test', text: 'Hello' });

    expect(result).toEqual({ sent: false, reason: 'missing_recipient' });
  });
});
