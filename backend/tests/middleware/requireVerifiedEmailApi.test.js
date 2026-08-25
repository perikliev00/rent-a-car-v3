const { requireVerifiedEmailApi } = require('../../src/middleware/auth');

function buildRes() {
  const res = {
    statusCode: null,
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

function run(session) {
  const req = { session };
  const res = buildRes();
  const next = jest.fn();
  requireVerifiedEmailApi(req, res, next);
  return { res, next };
}

describe('requireVerifiedEmailApi', () => {
  test('passes a verified session through', () => {
    const { res, next } = run({
      isLoggedIn: true,
      user: { id: 1, emailVerified: true },
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });

  test('rejects an authenticated but unverified session with 403', () => {
    const { res, next } = run({
      isLoggedIn: true,
      user: { id: 1, emailVerified: false },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED');
  });

  test('fails closed for a legacy session that predates the flag', () => {
    const { res, next } = run({ isLoggedIn: true, user: { id: 1 } });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED');
  });

  test('rejects an anonymous request with 401', () => {
    const { res, next } = run({});

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('rejects a request with no session at all', () => {
    const req = {};
    const res = buildRes();
    const next = jest.fn();

    requireVerifiedEmailApi(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
