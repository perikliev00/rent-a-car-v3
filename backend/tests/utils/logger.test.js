const pino = require('pino');

const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'password',
  'req.body.password',
  'req.body.email',
  'req.body.phoneNumber',
  'req.body.address',
  'req.body.fullName',
  'email',
  'to',
];

describe('logger redaction', () => {
  test('redacts configured sensitive paths', () => {
    const logs = [];
    const testLogger = pino(
      {
        level: 'info',
        redact: {
          paths: REDACT_PATHS,
          censor: '[Redacted]',
        },
      },
      {
        write(message) {
          logs.push(JSON.parse(message));
        },
      }
    );

    testLogger.info({
      email: 'user@example.com',
      to: 'user@example.com',
      password: 'Secret123',
      req: {
        headers: {
          cookie: 'sid=abc123',
          authorization: 'Bearer token',
        },
        body: {
          email: 'user@example.com',
          phoneNumber: '+359888',
          address: 'Main St',
          fullName: 'Jane Doe',
        },
      },
    });

    const entry = logs[0];
    expect(entry.email).toBe('[Redacted]');
    expect(entry.to).toBe('[Redacted]');
    expect(entry.password).toBe('[Redacted]');
    expect(entry.req.headers.cookie).toBe('[Redacted]');
    expect(entry.req.headers.authorization).toBe('[Redacted]');
    expect(entry.req.body.email).toBe('[Redacted]');
    expect(entry.req.body.phoneNumber).toBe('[Redacted]');
    expect(entry.req.body.address).toBe('[Redacted]');
    expect(entry.req.body.fullName).toBe('[Redacted]');
  });
});
