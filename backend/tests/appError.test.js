const {
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  isAppError,
} = require('../src/utils/appError');

describe('AppError classes', () => {
  test('ValidationError has 422 status and operational flag', () => {
    const err = new ValidationError('Bad input', { field: 'email' });

    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ field: 'email' });
    expect(err.isOperational).toBe(true);
    expect(isAppError(err)).toBe(true);
  });

  test('AuthError and ForbiddenError use correct HTTP codes', () => {
    expect(new AuthError().status).toBe(401);
    expect(new ForbiddenError().status).toBe(403);
    expect(new NotFoundError().status).toBe(404);
  });

  test('isAppError returns false for plain Error', () => {
    expect(isAppError(new Error('boom'))).toBe(false);
  });
});
