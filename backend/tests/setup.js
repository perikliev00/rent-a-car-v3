const fs = require('fs');
const path = require('path');

fs.mkdirSync(path.join(__dirname, '..', 'test-results'), { recursive: true });

process.env.NODE_ENV = 'test';
process.env.STRIPE_SECRET =
  process.env.STRIPE_SECRET || 'sk_test_jest_placeholder_key_1234567890';
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_jest_placeholder_secret';
process.env.FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

// Default unit suite must not inherit STRIPE_STUB from a developer shell / prior integration run.
// Integration setup re-enables the stub explicitly.
delete process.env.STRIPE_STUB;

require('../src/config/env').validateEnv();
