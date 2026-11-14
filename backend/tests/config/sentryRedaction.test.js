/**
 * Paid-conflict context may include fullName; Sentry beforeSend must scrub it.
 */
describe('sentry PII scrubbing', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('beforeSend redacts fullName, email, and phoneNumber in event.extra', () => {
    let beforeSend;
    jest.doMock('@sentry/node', () => ({
      init: (opts) => {
        beforeSend = opts.beforeSend;
      },
      withScope: (fn) => fn({ setTag() {}, setContext() {} }),
      captureException() {},
      captureMessage() {},
    }));

    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    const sentry = require('../../src/config/sentry');
    sentry.initSentry();

    const event = beforeSend({
      extra: {
        reservationId: '99',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: '+359888123456',
        conflictReason: 'overlap_after_payment',
      },
    });

    expect(event.extra.reservationId).toBe('99');
    expect(event.extra.conflictReason).toBe('overlap_after_payment');
    expect(event.extra.fullName).toBe('[Redacted]');
    expect(event.extra.email).toBe('[Redacted]');
    expect(event.extra.phoneNumber).toBe('[Redacted]');
  });
});
