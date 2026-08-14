const stripeTestStub = require('../../src/services/payment/stripeTestStub');

beforeEach(() => {
  stripeTestStub.clearSessions();
});
