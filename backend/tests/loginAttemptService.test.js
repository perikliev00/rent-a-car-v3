// Require the '../src/services/auth/loginAttemptService' module as loginAttemptService.
const loginAttemptService = require('../src/services/auth/loginAttemptService');

// Declare a test suite grouping related cases.
describe('loginAttemptService', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call loginAttemptService.resetForTests to perform this step.
    loginAttemptService.resetForTests();
  });

  // Define a single test case and its expectations.
  test('locks an account after repeated failures', () => {
    // Create the email constant.
    const email = 'user@example.com';

    // Iterate using the loop initializer, condition, and step.
    for (let i = 0; i < loginAttemptService.MAX_ATTEMPTS; i += 1) {
      // Call loginAttemptService.recordFailure to perform this step.
      loginAttemptService.recordFailure(email, { ip: '127.0.0.1' });
    }

    // Assert that the value matches the intended expectation.
    expect(loginAttemptService.isLocked(email)).toBe(true);
  });

  // Define a single test case and its expectations.
  test('clears attempts after a successful login', () => {
    // Create the email constant.
    const email = 'user@example.com';

    // Call loginAttemptService.recordFailure to perform this step.
    loginAttemptService.recordFailure(email);
    // Call loginAttemptService.clearAttempts to perform this step.
    loginAttemptService.clearAttempts(email);

    // Assert that the value matches the intended expectation.
    expect(loginAttemptService.isLocked(email)).toBe(false);
  });

  // Define a single test case and its expectations.
  test('normalizes email before tracking', () => {
    // Iterate using the loop initializer, condition, and step.
    for (let i = 0; i < loginAttemptService.MAX_ATTEMPTS; i += 1) {
      // Call loginAttemptService.recordFailure to perform this step.
      loginAttemptService.recordFailure(' User@Example.com ');
    }

    // Assert that the value matches the intended expectation.
    expect(loginAttemptService.isLocked('user@example.com')).toBe(true);
  });
});
