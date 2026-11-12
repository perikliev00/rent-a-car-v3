// Destructure object properties into local variables.
const { apiLoginAttemptGuard } = require('../../src/middleware/apiLoginAttemptGuard');
// Require the '../../src/services/auth/loginAttemptService' module as loginAttemptService.
const loginAttemptService = require('../../src/services/auth/loginAttemptService');

// Declare a test suite grouping related cases.
describe('apiLoginAttemptGuard', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call loginAttemptService.resetForTests to perform this step.
    loginAttemptService.resetForTests();
  });

  // Define the createMockRes function.
  function createMockRes() {
    // Create the res constant.
    const res = {
      // Provide the status code field value.
      statusCode: 200,
      // Provide the body field value.
      body: null,
      // Call status to perform this step.
      status(code) {
        // Update this.statusCode with the right-hand side value.
        this.statusCode = code;
        // Return the resulting value to the caller.
        return this;
      },
      // Call json to perform this step.
      json(payload) {
        // Update this.body with the right-hand side value.
        this.body = payload;
        // Return the resulting value to the caller.
        return this;
      },
    };
    // Return the resulting value to the caller.
    return res;
  }

  // Define a single test case and its expectations.
  test('calls next when email is not locked', () => {
    // Create the req constant.
    const req = { body: { email: 'user@example.com' } };
    // Create the res constant.
    const res = createMockRes();
    // Create the next constant.
    const next = jest.fn();

    // Call apiLoginAttemptGuard to perform this step.
    apiLoginAttemptGuard(req, res, next);

    // Assert that the value matches the intended expectation.
    expect(next).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(res.body).toBeNull();
  });

  // Define a single test case and its expectations.
  test('blocks request when account is locked', () => {
    // Iterate using the loop initializer, condition, and step.
    for (let i = 0; i < loginAttemptService.MAX_ATTEMPTS; i += 1) {
      // Call loginAttemptService.recordFailure to perform this step.
      loginAttemptService.recordFailure('locked@example.com');
    }

    // Create the req constant.
    const req = { body: { email: 'locked@example.com' } };
    // Create the res constant.
    const res = createMockRes();
    // Create the next constant.
    const next = jest.fn();

    // Call apiLoginAttemptGuard to perform this step.
    apiLoginAttemptGuard(req, res, next);

    // Assert that the value matches the intended expectation.
    expect(next).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(res.statusCode).toBe(429);
    // Assert that the value matches the intended expectation.
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
