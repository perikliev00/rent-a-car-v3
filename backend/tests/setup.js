// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');

// Call fs.mkdirSync to perform this step.
fs.mkdirSync(path.join(__dirname, '..', 'test-results'), { recursive: true });

// Update process.env.NODE_ENV with the right-hand side value.
process.env.NODE_ENV = 'test';
// Update process.env.STRIPE_SECRET with the right-hand side value.
process.env.STRIPE_SECRET =
  // Contribute this line to the enclosing declaration or statement.
  process.env.STRIPE_SECRET || 'sk_test_jest_placeholder_key_1234567890';
// Update process.env.STRIPE_WEBHOOK_SECRET with the right-hand side value.
process.env.STRIPE_WEBHOOK_SECRET =
  // Contribute this line to the enclosing declaration or statement.
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_jest_placeholder_secret';
// Update process.env.FRONTEND_BASE_URL with the right-hand side value.
process.env.FRONTEND_BASE_URL =
  // Contribute this line to the enclosing declaration or statement.
  process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

// Default unit suite must not inherit STRIPE_STUB from a developer shell / prior integration run.
// Integration setup re-enables the stub explicitly.
delete process.env.STRIPE_STUB;

// Call require to perform this step.
require('../src/config/env').validateEnv();
