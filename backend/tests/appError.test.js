// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  ValidationError,
  // Contribute this line to the enclosing declaration or statement.
  AuthError,
  // Contribute this line to the enclosing declaration or statement.
  ForbiddenError,
  // Contribute this line to the enclosing declaration or statement.
  NotFoundError,
  // Contribute this line to the enclosing declaration or statement.
  isAppError,
// Continue the surrounding logic with this statement.
} = require('../src/utils/appError');

// Declare a test suite grouping related cases.
describe('AppError classes', () => {
  // Define a single test case and its expectations.
  test('ValidationError has 422 status and operational flag', () => {
    // Create the err constant.
    const err = new ValidationError('Bad input', { field: 'email' });

    // Assert that the value matches the intended expectation.
    expect(err.status).toBe(422);
    // Assert that the value matches the intended expectation.
    expect(err.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(err.details).toEqual({ field: 'email' });
    // Assert that the value matches the intended expectation.
    expect(err.isOperational).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isAppError(err)).toBe(true);
  });

  // Define a single test case and its expectations.
  test('AuthError and ForbiddenError use correct HTTP codes', () => {
    // Assert that the value matches the intended expectation.
    expect(new AuthError().status).toBe(401);
    // Assert that the value matches the intended expectation.
    expect(new ForbiddenError().status).toBe(403);
    // Assert that the value matches the intended expectation.
    expect(new NotFoundError().status).toBe(404);
  });

  // Define a single test case and its expectations.
  test('isAppError returns false for plain Error', () => {
    // Assert that the value matches the intended expectation.
    expect(isAppError(new Error('boom'))).toBe(false);
  });
});
