const stripeTestStub = require('../../src/services/payment/stripeTestStub');
const pool = require('../../src/db/pool');

beforeEach(() => {
  stripeTestStub.clearSessions();
});

afterAll(async () => {
  if (pool && typeof pool.end === 'function' && !pool.ended && !pool.ending) {
    await pool.end();
  }
});

