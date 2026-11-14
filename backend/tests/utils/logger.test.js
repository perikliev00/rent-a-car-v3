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
    expect(entry.password).toBe('[Redacted]');
    expect(entry.req.headers.cookie).toBe('[Redacted]');
    expect(entry.req.headers.authorization).toBe('[Redacted]');
    expect(entry.req.body.email).toBe('[Redacted]');
    expect(entry.req.body.phoneNumber).toBe('[Redacted]');
    expect(entry.req.body.address).toBe('[Redacted]');
    expect(entry.req.body.fullName).toBe('[Redacted]');
  });
});

describe('shared logger redaction (real src/utils/logger config)', () => {
  const { spawnSync } = require('child_process');
  const path = require('path');

  function logWithRealLogger(snippet) {
    const script = `
      const logger = require('./src/utils/logger');
      ${snippet}
    `;
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..', '..'),
      env: { ...process.env, NODE_ENV: 'production', LOG_LEVEL: 'info' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    return result.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  test('redacts top-level and nested fullName/phoneNumber/email (paid conflict context shape)', () => {
    const entries = logWithRealLogger(`
      logger.error({
        reservationId: '1',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: '+359888123456',
        to: 'recipient@example.com',
        customer: { fullName: 'Nested Jane', email: 'n@example.com', phoneNumber: '+359111' },
      }, 'Paid reservation requires manual review due to availability conflict');
    `);
    const raw = JSON.stringify(entries);
    for (const secret of [
      'Jane Doe',
      'jane@example.com',
      '+359888123456',
      'Nested Jane',
      'n@example.com',
      '+359111',
      'recipient@example.com',
    ]) {
      expect(raw).not.toContain(secret);
    }
    expect(entries[0].fullName).toBe('[Redacted]');
    expect(entries[0].email).toBe('[Redacted]');
    expect(entries[0].phoneNumber).toBe('[Redacted]');
    expect(entries[0].reservationId).toBe('1');
  });
});