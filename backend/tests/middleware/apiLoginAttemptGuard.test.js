const { apiLoginAttemptGuard } = require('../../src/middleware/apiLoginAttemptGuard');
const loginAttemptService = require('../../src/services/auth/loginAttemptService');

describe('apiLoginAttemptGuard', () => {
  beforeEach(() => {
    loginAttemptService.resetForTests();
  });

  function createMockRes() {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    return res;
  }

  test('calls next when email is not locked', () => {
    const req = { body: { email: 'user@example.com' } };
    const res = createMockRes();
    const next = jest.fn();

    apiLoginAttemptGuard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.body).toBeNull();
  });

  test('blocks request when account is locked', () => {
    for (let i = 0; i < loginAttemptService.MAX_ATTEMPTS; i += 1) {
      loginAttemptService.recordFailure('locked@example.com');
    }

    const req = { body: { email: 'locked@example.com' } };
    const res = createMockRes();
    const next = jest.fn();

    apiLoginAttemptGuard(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
