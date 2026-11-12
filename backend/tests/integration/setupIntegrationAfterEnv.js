// Require the '../../src/services/payment/stripeTestStub' module as stripeTestStub.
const stripeTestStub = require('../../src/services/payment/stripeTestStub');
// Require the '../../src/db/pool' module as pool.
const pool = require('../../src/db/pool');

// Register setup that runs before the tests.
beforeEach(() => {
  // Call stripeTestStub.clearSessions to perform this step.
  stripeTestStub.clearSessions();
});

// Register cleanup that runs after the tests.
afterAll(async () => {
  // Evaluate the condition and enter the branch when it is true.
  if (pool && typeof pool.end === 'function' && !pool.ended && !pool.ending) {
    // Wait until the asynchronous operation resolves.
    await pool.end();
  }
});

