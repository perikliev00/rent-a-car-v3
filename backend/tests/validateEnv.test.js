// Create the original env constant.
const ORIGINAL_ENV = { ...process.env };

// Define the loadEnvModule function.
function loadEnvModule() {
  // Reserve the env module variable for later assignment.
  let envModule;
  // Call jest.isolateModules to perform this step.
  jest.isolateModules(() => {
    // Update envModule with the right-hand side value.
    envModule = require('../src/config/env');
  });
  // Return the resulting value to the caller.
  return envModule;
}

// Define the baseValidEnv function.
function baseValidEnv(overrides = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the node env field value.
    NODE_ENV: 'development',
    // Provide the database url field value.
    DATABASE_URL: 'postgres://user:pass@localhost:5432/luxride',
    // Provide the session secret field value.
    SESSION_SECRET: 'a'.repeat(32),
    // Provide the stripe secret field value.
    STRIPE_SECRET: 'sk_test_123456789012345678901234567890',
    // Provide the stripe webhook secret field value.
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    // Spread overrides into the surrounding structure.
    ...overrides,
  };
}

// Define the productionEnv function.
function productionEnv(overrides = {}) {
  // Return the resulting value to the caller.
  return baseValidEnv({
    // Provide the node env field value.
    NODE_ENV: 'production',
    // Provide the database url field value.
    DATABASE_URL: 'postgres://user:pass@db.internal:5432/luxride',
    // Provide the stripe secret field value.
    STRIPE_SECRET: 'sk_live_test123456789012345678901234567890',
    // Provide the stripe webhook secret field value.
    STRIPE_WEBHOOK_SECRET: 'whsec_live_secret_value_ok',
    // Provide the frontend base url field value.
    FRONTEND_BASE_URL: 'https://app.example.com',
    // Provide the cors origins field value.
    CORS_ORIGINS: 'https://app.example.com,https://admin.example.com',
    // Provide the storage driver field value.
    STORAGE_DRIVER: 's3',
    // Provide the s3 bucket field value.
    S3_BUCKET: 'luxride-uploads',
    // Provide the storage public base url field value.
    STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
    // Provide the private storage driver field value.
    PRIVATE_STORAGE_DRIVER: 's3',
    // Provide the private s3 bucket field value.
    PRIVATE_S3_BUCKET: 'luxride-private-docs',
    // Provide the email enabled field value.
    EMAIL_ENABLED: 'true',
    // Provide the smtp host field value.
    SMTP_HOST: 'smtp.example.com',
    // Provide the smtp user field value.
    SMTP_USER: 'smtp-user',
    // Provide the smtp pass field value.
    SMTP_PASS: 'smtp-pass',
    // Provide the mail from field value.
    MAIL_FROM: 'noreply@example.com',
    // Spread overrides into the surrounding structure.
    ...overrides,
  });
}

// Declare a test suite grouping related cases.
describe('validateEnv', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.resetModules to perform this step.
    jest.resetModules();
    // Update process.env with the right-hand side value.
    process.env = { ...ORIGINAL_ENV };
  });

  // Register cleanup that runs after the tests.
  afterAll(() => {
    // Update process.env with the right-hand side value.
    process.env = ORIGINAL_ENV;
  });

  // Define a single test case and its expectations.
  test('passes with minimal development config', () => {
    // Update process.env with the right-hand side value.
    process.env = baseValidEnv();
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).not.toThrow();
  });

  // Define a single test case and its expectations.
  test('throws when DATABASE_URL is missing', () => {
    // Update process.env with the right-hand side value.
    process.env = baseValidEnv();
    // Delete the specified property from the object.
    delete process.env.DATABASE_URL;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Missing required env var(s): DATABASE_URL');
  });

  // Define a single test case and its expectations.
  test('throws when SESSION_SECRET is missing', () => {
    // Update process.env with the right-hand side value.
    process.env = baseValidEnv();
    // Delete the specified property from the object.
    delete process.env.SESSION_SECRET;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Missing required env var(s): SESSION_SECRET');
  });

  // Define a single test case and its expectations.
  test('throws when SESSION_SECRET is too short', () => {
    // Update process.env with the right-hand side value.
    process.env = baseValidEnv({ SESSION_SECRET: 'too-short' });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('SESSION_SECRET must be at least 32 characters');
  });

  // Define a single test case and its expectations.
  test('rejects known default SESSION_SECRET', () => {
    // Update process.env with the right-hand side value.
    process.env = baseValidEnv({
      // Provide the session secret field value.
      SESSION_SECRET: 'replace_me_with_32_plus_random_chars',
    });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('SESSION_SECRET is a known weak/default value');
  });

  // Define a single test case and its expectations.
  test('requires Stripe secrets in development', () => {
    // Update process.env with the right-hand side value.
    process.env = baseValidEnv();
    // Delete the specified property from the object.
    delete process.env.STRIPE_SECRET;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Missing required env var(s): STRIPE_SECRET');
  });

  // Define a single test case and its expectations.
  test('requires Stripe secrets in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv();
    // Delete the specified property from the object.
    delete process.env.STRIPE_WEBHOOK_SECRET;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Missing required env var(s): STRIPE_WEBHOOK_SECRET');
  });

  // Define a single test case and its expectations.
  test('requires FRONTEND_BASE_URL in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv();
    // Delete the specified property from the object.
    delete process.env.FRONTEND_BASE_URL;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Missing required env var(s): FRONTEND_BASE_URL');
  });

  // Define a single test case and its expectations.
  test('requires CORS_ORIGINS in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv();
    // Delete the specified property from the object.
    delete process.env.CORS_ORIGINS;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('CORS_ORIGINS must be set in production');
  });

  // Define a single test case and its expectations.
  test('rejects test Stripe key in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({
      // Provide the stripe secret field value.
      STRIPE_SECRET: 'sk_test_123456789012345678901234567890',
    });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('STRIPE_SECRET must be a live key');
  });

  // Define a single test case and its expectations.
  test('rejects STRIPE_STUB in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({ STRIPE_STUB: '1' });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('STRIPE_STUB must be disabled in production');
  });

  // Define a single test case and its expectations.
  test('rejects placeholder Stripe webhook secret in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({ STRIPE_WEBHOOK_SECRET: 'whsec_test_secret' });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('STRIPE_WEBHOOK_SECRET is a known weak/default value');
  });

  // Define a single test case and its expectations.
  test('rejects localhost FRONTEND_BASE_URL in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({ FRONTEND_BASE_URL: 'https://localhost:5173' });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow(
      // Supply the literal value used by the enclosing expression.
      'FRONTEND_BASE_URL must not use a development host in production'
    );
  });

  // Define a single test case and its expectations.
  test('rejects http FRONTEND_BASE_URL in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({ FRONTEND_BASE_URL: 'http://app.example.com' });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('FRONTEND_BASE_URL must use HTTPS in production');
  });

  // Define a single test case and its expectations.
  test('rejects localhost CORS origins in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({
      // Provide the cors origins field value.
      CORS_ORIGINS: 'https://app.example.com,http://localhost:5173',
    });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('CORS_ORIGINS entry must use HTTPS in production');
  });

  // Define a single test case and its expectations.
  test('rejects development DATABASE_URL host in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({
      // Provide the database url field value.
      DATABASE_URL: 'postgres://user:pass@localhost:5432/luxride',
    });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow(
      // Supply the literal value used by the enclosing expression.
      'DATABASE_URL must not point at a development host in production'
    );
  });

  // Define a single test case and its expectations.
  test('rejects disabled SESSION_COOKIE_SECURE in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({ SESSION_COOKIE_SECURE: 'false' });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow(
      // Supply the literal value used by the enclosing expression.
      'SESSION_COOKIE_SECURE must not be disabled in production'
    );
  });

  // Define a single test case and its expectations.
  test('requires full SMTP config when EMAIL_ENABLED=true', () => {
    // Update process.env with the right-hand side value.
    process.env = baseValidEnv({
      // Provide the email enabled field value.
      EMAIL_ENABLED: 'true',
      // Provide the smtp host field value.
      SMTP_HOST: 'smtp.example.com',
    });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Missing required env var(s): SMTP_USER, SMTP_PASS, MAIL_FROM');
  });

  // Define a single test case and its expectations.
  test('rejects partial SMTP config without EMAIL_ENABLED', () => {
    // Update process.env with the right-hand side value.
    process.env = baseValidEnv({
      // Provide the smtp host field value.
      SMTP_HOST: 'smtp.example.com',
    });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Partial SMTP configuration detected');
  });

  // Define a single test case and its expectations.
  test('requires EMAIL_ENABLED and SMTP in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv();
    // Delete the specified property from the object.
    delete process.env.EMAIL_ENABLED;
    // Delete the specified property from the object.
    delete process.env.SMTP_HOST;
    // Delete the specified property from the object.
    delete process.env.SMTP_USER;
    // Delete the specified property from the object.
    delete process.env.SMTP_PASS;
    // Delete the specified property from the object.
    delete process.env.MAIL_FROM;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow(
      // Supply the literal value used by the enclosing expression.
      'EMAIL_ENABLED must be true with full SMTP configuration in production'
    );
  });

  // Define a single test case and its expectations.
  test('requires S3 public storage in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({ STORAGE_DRIVER: 'local' });
    // Delete the specified property from the object.
    delete process.env.S3_BUCKET;
    // Delete the specified property from the object.
    delete process.env.STORAGE_PUBLIC_BASE_URL;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('STORAGE_DRIVER must be s3 in production');
  });

  // Define a single test case and its expectations.
  test('requires S3 settings in production when STORAGE_DRIVER=s3', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({
      // Provide the storage driver field value.
      STORAGE_DRIVER: 's3',
      // Provide the s3 bucket field value.
      S3_BUCKET: 'luxride-uploads',
    });
    // Delete the specified property from the object.
    delete process.env.STORAGE_PUBLIC_BASE_URL;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Missing required env var(s): STORAGE_PUBLIC_BASE_URL');
  });

  // Define a single test case and its expectations.
  test('rejects ephemeral local private storage in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({
      // Provide the private storage driver field value.
      PRIVATE_STORAGE_DRIVER: 'local',
    });
    // Delete the specified property from the object.
    delete process.env.PRIVATE_STORAGE_PERSISTENT;
    // Delete the specified property from the object.
    delete process.env.PRIVATE_S3_BUCKET;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Private document storage is local and ephemeral');
  });

  // Define a single test case and its expectations.
  test('allows local private storage in production when persistence is attested', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({
      // Provide the private storage driver field value.
      PRIVATE_STORAGE_DRIVER: 'local',
      // Provide the private storage persistent field value.
      PRIVATE_STORAGE_PERSISTENT: 'true',
    });
    // Delete the specified property from the object.
    delete process.env.PRIVATE_S3_BUCKET;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();
    // Create the config constant.
    const config = validateEnv();

    // Assert that the value matches the intended expectation.
    expect(config.privateStorageDriver).toBe('local');
    // Assert that the value matches the intended expectation.
    expect(config.sessionCookieSecure).toBe(true);
  });

  // Define a single test case and its expectations.
  test('requires PRIVATE_S3_BUCKET in production when PRIVATE_STORAGE_DRIVER=s3', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({
      // Provide the private storage driver field value.
      PRIVATE_STORAGE_DRIVER: 's3',
    });
    // Delete the specified property from the object.
    delete process.env.PRIVATE_STORAGE_PERSISTENT;
    // Delete the specified property from the object.
    delete process.env.PRIVATE_S3_BUCKET;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Missing required env var(s): PRIVATE_S3_BUCKET');
  });

  // Define a single test case and its expectations.
  test('allows private S3 storage in production without persistence attestation', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({
      // Provide the private storage driver field value.
      PRIVATE_STORAGE_DRIVER: 's3',
      // Provide the private s3 bucket field value.
      PRIVATE_S3_BUCKET: 'luxride-private-docs',
    });
    // Delete the specified property from the object.
    delete process.env.PRIVATE_STORAGE_PERSISTENT;
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();
    // Create the config constant.
    const config = validateEnv();

    // Assert that the value matches the intended expectation.
    expect(config.privateStorageDriver).toBe('s3');
  });

  // Define a single test case and its expectations.
  test('rejects unknown PRIVATE_STORAGE_DRIVER in production', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv({
      // Provide the private storage driver field value.
      PRIVATE_STORAGE_DRIVER: 'gcs',
    });
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).toThrow('Unsupported PRIVATE_STORAGE_DRIVER: gcs');
  });

  // Define a single test case and its expectations.
  test('passes with full production config', () => {
    // Update process.env with the right-hand side value.
    process.env = productionEnv();
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();
    // Create the config constant.
    const config = validateEnv();

    // Assert that the value matches the intended expectation.
    expect(config.isProd).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(config.storageDriver).toBe('s3');
    // Assert that the value matches the intended expectation.
    expect(config.emailEnabled).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(config.sessionCookieSecure).toBe(true);
  });

  // Define a single test case and its expectations.
  test('skips validation in test environment', () => {
    // Update process.env with the right-hand side value.
    process.env = { NODE_ENV: 'test' };
    // Destructure object properties into local variables.
    const { validateEnv } = loadEnvModule();

    // Assert that the value matches the intended expectation.
    expect(() => validateEnv()).not.toThrow();
  });
});
