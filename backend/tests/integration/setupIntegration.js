// Update process.env.EMAIL_ENABLED with the right-hand side value.
process.env.EMAIL_ENABLED = 'false';
// Update process.env.STRIPE_STUB with the right-hand side value.
process.env.STRIPE_STUB = '1';
// Update process.env.STRIPE_WEBHOOK_SECRET with the right-hand side value.
process.env.STRIPE_WEBHOOK_SECRET =
  // Contribute this line to the enclosing declaration or statement.
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_jest_placeholder_secret';
// Update process.env.STRIPE_SECRET with the right-hand side value.
process.env.STRIPE_SECRET =
  // Contribute this line to the enclosing declaration or statement.
  process.env.STRIPE_SECRET || 'sk_test_jest_placeholder_key_1234567890';

// Call jest.mock to perform this step.
jest.mock('../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../helpers/rateLimitPassthrough')
);

