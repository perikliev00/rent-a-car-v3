const OUTBOX_PATH = '../../../src/services/email/testOutbox';

function loadOutbox() {
  jest.resetModules();
  return require(OUTBOX_PATH);
}

describe('test-only mail outbox', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.EMAIL_TEST_OUTBOX;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) {
      delete process.env.EMAIL_TEST_OUTBOX;
    } else {
      process.env.EMAIL_TEST_OUTBOX = originalFlag;
    }
  });

  test('is inert unless explicitly enabled in a test environment', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.EMAIL_TEST_OUTBOX;
    const outbox = loadOutbox();

    expect(outbox.isEnabled()).toBe(false);

    outbox.record({ to: 'user@example.com', kind: 'email_verification', text: 'secret-token' });

    expect(outbox.list()).toEqual([]);
    expect(outbox.findLatest({ to: 'user@example.com' })).toBeNull();
  });

  test('never activates outside a test environment even with the flag set', () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_TEST_OUTBOX = '1';
    const outbox = loadOutbox();

    expect(outbox.isEnabled()).toBe(false);

    outbox.record({ to: 'user@example.com', kind: 'email_verification', text: 'secret-token' });

    expect(outbox.list()).toEqual([]);
  });

  test('captures messages when explicitly enabled so tests can read mailed tokens', () => {
    process.env.NODE_ENV = 'test';
    process.env.EMAIL_TEST_OUTBOX = '1';
    const outbox = loadOutbox();
    outbox.clear();

    expect(outbox.isEnabled()).toBe(true);

    outbox.record({
      to: 'User@Example.com',
      kind: 'email_verification',
      text: 'link with token',
    });
    outbox.record({ to: 'other@example.com', kind: 'reservation_claim', text: 'other' });

    const found = outbox.findLatest({ to: 'user@example.com', kind: 'email_verification' });
    expect(found?.text).toBe('link with token');
    expect(outbox.list({ kind: 'reservation_claim' })).toHaveLength(1);
  });
});
