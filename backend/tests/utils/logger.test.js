// Require the 'pino' module as pino.
const pino = require('pino');

// Create the redact paths constant.
const REDACT_PATHS = [
  // Supply the literal value used by the enclosing expression.
  'req.headers.cookie',
  // Supply the literal value used by the enclosing expression.
  'req.headers.authorization',
  // Supply the literal value used by the enclosing expression.
  'password',
  // Supply the literal value used by the enclosing expression.
  'req.body.password',
  // Supply the literal value used by the enclosing expression.
  'req.body.email',
  // Supply the literal value used by the enclosing expression.
  'req.body.phoneNumber',
  // Supply the literal value used by the enclosing expression.
  'req.body.address',
  // Supply the literal value used by the enclosing expression.
  'req.body.fullName',
  // Supply the literal value used by the enclosing expression.
  'email',
];

// Declare a test suite grouping related cases.
describe('logger redaction', () => {
  // Define a single test case and its expectations.
  test('redacts configured sensitive paths', () => {
    // Create the logs constant.
    const logs = [];
    // Create the test logger constant.
    const testLogger = pino(
      {
        // Provide the level field value.
        level: 'info',
        // Provide the redact field value.
        redact: {
          // Provide the paths field value.
          paths: REDACT_PATHS,
          // Provide the censor field value.
          censor: '[Redacted]',
        },
      },
      {
        // Call write to perform this step.
        write(message) {
          // Call logs.push to perform this step.
          logs.push(JSON.parse(message));
        },
      }
    );

    // Call testLogger.info to perform this step.
    testLogger.info({
      // Provide the email field value.
      email: 'user@example.com',
      // Provide the password field value.
      password: 'Secret123',
      // Provide the req field value.
      req: {
        // Provide the headers field value.
        headers: {
          // Provide the cookie field value.
          cookie: 'sid=abc123',
          // Provide the authorization field value.
          authorization: 'Bearer token',
        },
        // Provide the body field value.
        body: {
          // Provide the email field value.
          email: 'user@example.com',
          // Provide the phone number field value.
          phoneNumber: '+359888',
          // Provide the address field value.
          address: 'Main St',
          // Provide the full name field value.
          fullName: 'Jane Doe',
        },
      },
    });

    // Create the entry constant.
    const entry = logs[0];
    // Assert that the value matches the intended expectation.
    expect(entry.email).toBe('[Redacted]');
    // Assert that the value matches the intended expectation.
    expect(entry.password).toBe('[Redacted]');
    // Assert that the value matches the intended expectation.
    expect(entry.req.headers.cookie).toBe('[Redacted]');
    // Assert that the value matches the intended expectation.
    expect(entry.req.headers.authorization).toBe('[Redacted]');
    // Assert that the value matches the intended expectation.
    expect(entry.req.body.email).toBe('[Redacted]');
    // Assert that the value matches the intended expectation.
    expect(entry.req.body.phoneNumber).toBe('[Redacted]');
    // Assert that the value matches the intended expectation.
    expect(entry.req.body.address).toBe('[Redacted]');
    // Assert that the value matches the intended expectation.
    expect(entry.req.body.fullName).toBe('[Redacted]');
  });
});
