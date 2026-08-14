const loginAttemptService = require('../src/services/auth/loginAttemptService');

describe('loginAttemptService', () => {
  beforeEach(() => {
    loginAttemptService.resetForTests();
  });

  test('locks an account after repeated failures', () => {
    const email = 'user@example.com';

    for (let i = 0; i < loginAttemptService.MAX_ATTEMPTS; i += 1) {
      loginAttemptService.recordFailure(email, { ip: '127.0.0.1' });
    }

    expect(loginAttemptService.isLocked(email)).toBe(true);
  });

  test('clears attempts after a successful login', () => {
    const email = 'user@example.com';

    loginAttemptService.recordFailure(email);
    loginAttemptService.clearAttempts(email);

    expect(loginAttemptService.isLocked(email)).toBe(false);
  });

  test('normalizes email before tracking', () => {
    for (let i = 0; i < loginAttemptService.MAX_ATTEMPTS; i += 1) {
      loginAttemptService.recordFailure(' User@Example.com ');
    }

    expect(loginAttemptService.isLocked('user@example.com')).toBe(true);
  });
});
