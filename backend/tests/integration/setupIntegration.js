process.env.EMAIL_ENABLED = 'false';
process.env.STRIPE_STUB = '1';
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_jest_placeholder_secret';
process.env.STRIPE_SECRET =
  process.env.STRIPE_SECRET || 'sk_test_jest_placeholder_key_1234567890';

jest.mock('../../src/middleware/rateLimit', () =>
  require('../helpers/rateLimitPassthrough')
);

