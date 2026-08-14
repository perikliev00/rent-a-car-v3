const ORIGINAL_ENV = { ...process.env };

function loadEnvModule() {
  let envModule;
  jest.isolateModules(() => {
    envModule = require('../src/config/env');
  });
  return envModule;
}

function baseValidEnv(overrides = {}) {
  return {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://user:pass@localhost:5432/luxride',
    SESSION_SECRET: 'a'.repeat(32),
    STRIPE_SECRET: 'sk_test_123456789012345678901234567890',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    ...overrides,
  };
}

function productionEnv(overrides = {}) {
  return baseValidEnv({
    NODE_ENV: 'production',
    STRIPE_SECRET: 'sk_live_test123456789012345678901234567890',
    STRIPE_WEBHOOK_SECRET: 'whsec_live_secret',
    FRONTEND_BASE_URL: 'https://app.example.com',
    CORS_ORIGINS: 'https://app.example.com',
    ...overrides,
  });
}

describe('validateEnv', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('passes with minimal development config', () => {
    process.env = baseValidEnv();
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).not.toThrow();
  });

  test('throws when DATABASE_URL is missing', () => {
    process.env = baseValidEnv();
    delete process.env.DATABASE_URL;
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('Missing required env var(s): DATABASE_URL');
  });

  test('throws when SESSION_SECRET is missing', () => {
    process.env = baseValidEnv();
    delete process.env.SESSION_SECRET;
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('Missing required env var(s): SESSION_SECRET');
  });

  test('throws when SESSION_SECRET is too short', () => {
    process.env = baseValidEnv({ SESSION_SECRET: 'too-short' });
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('SESSION_SECRET must be at least 32 characters');
  });

  test('requires Stripe secrets in development', () => {
    process.env = baseValidEnv();
    delete process.env.STRIPE_SECRET;
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('Missing required env var(s): STRIPE_SECRET');
  });

  test('requires Stripe secrets in production', () => {
    process.env = productionEnv();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('Missing required env var(s): STRIPE_WEBHOOK_SECRET');
  });

  test('requires FRONTEND_BASE_URL in production', () => {
    process.env = productionEnv();
    delete process.env.FRONTEND_BASE_URL;
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('Missing required env var(s): FRONTEND_BASE_URL');
  });

  test('requires CORS_ORIGINS in production', () => {
    process.env = productionEnv();
    delete process.env.CORS_ORIGINS;
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('CORS_ORIGINS must be set in production');
  });

  test('rejects test Stripe key in production', () => {
    process.env = productionEnv({
      STRIPE_SECRET: 'sk_test_123456789012345678901234567890',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    });
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('STRIPE_SECRET must be a live key');
  });

  test('requires full SMTP config when EMAIL_ENABLED=true', () => {
    process.env = baseValidEnv({
      EMAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.com',
    });
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('Missing required env var(s): SMTP_USER, SMTP_PASS, MAIL_FROM');
  });

  test('rejects partial SMTP config without EMAIL_ENABLED', () => {
    process.env = baseValidEnv({
      SMTP_HOST: 'smtp.example.com',
    });
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('Partial SMTP configuration detected');
  });

  test('requires S3 settings in production when STORAGE_DRIVER=s3', () => {
    process.env = productionEnv({
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'luxride-uploads',
    });
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).toThrow('Missing required env var(s): STORAGE_PUBLIC_BASE_URL');
  });

  test('skips validation in test environment', () => {
    process.env = { NODE_ENV: 'test' };
    const { validateEnv } = loadEnvModule();

    expect(() => validateEnv()).not.toThrow();
  });
});
