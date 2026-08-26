#!/usr/bin/env node
/**
 * Smoke-check production Compose interpolation without starting containers.
 * SMTP must come from backend/.env (env_file), not root Compose ${SMTP_*} overrides.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const backendEnv = path.join(root, 'backend', '.env');
const composeFile = path.join(root, 'docker-compose.prod.yml');
const backup = path.join(root, 'backend', '.env.smoke.bak');

let createdBackendEnv = false;

function cleanup() {
  try {
    if (fs.existsSync(backup)) {
      fs.renameSync(backup, backendEnv);
    } else if (createdBackendEnv && fs.existsSync(backendEnv)) {
      fs.unlinkSync(backendEnv);
    }
  } catch (err) {
    console.error('cleanup warning:', err.message);
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});

const composeSrc = fs.readFileSync(composeFile, 'utf8');
if (/SMTP_HOST:\s*\$\{SMTP_HOST/.test(composeSrc)) {
  console.error('docker-compose.prod.yml must not interpolate SMTP from the shell');
  process.exit(1);
}
if (/EMAIL_ENABLED:\s*\$\{EMAIL_ENABLED/.test(composeSrc)) {
  console.error('docker-compose.prod.yml must not interpolate EMAIL_ENABLED from the shell');
  process.exit(1);
}

if (fs.existsSync(backendEnv)) {
  fs.copyFileSync(backendEnv, backup);
} else {
  createdBackendEnv = true;
}

fs.writeFileSync(
  backendEnv,
  [
    'NODE_ENV=production',
    'DATABASE_URL=postgres://luxride:ci-placeholder@db:5432/luxride',
    'SESSION_SECRET=ci-session-secret-32-chars-minimum!!',
    'FRONTEND_BASE_URL=https://example.com',
    'CORS_ORIGINS=https://example.com',
    'STRIPE_SECRET=sk_live_ci_placeholder_key_123456789012',
    'STRIPE_WEBHOOK_SECRET=whsec_ci_placeholder_secret',
    'EMAIL_ENABLED=true',
    'SMTP_HOST=smtp.example.com',
    'SMTP_PORT=587',
    'SMTP_USER=ci-smtp-user',
    'SMTP_PASS=ci-smtp-pass',
    'MAIL_FROM=noreply@example.com',
    'METRICS_TOKEN=ci-metrics-token-placeholder',
    '',
  ].join('\n'),
  'utf8'
);

const env = {
  ...process.env,
  POSTGRES_PASSWORD: 'ci-placeholder-password',
  FRONTEND_BASE_URL: 'https://example.com',
  CORS_ORIGINS: 'https://example.com',
  METRICS_TOKEN: 'ci-metrics-token-placeholder',
  VITE_API_BASE_URL: 'https://api.example.com',
  GRAFANA_ADMIN_PASSWORD: 'ci-grafana-admin-placeholder',
};
delete env.EMAIL_ENABLED;
delete env.SMTP_HOST;
delete env.SMTP_USER;
delete env.SMTP_PASS;
delete env.MAIL_FROM;

const result = spawnSync(
  'docker',
  ['compose', '-f', 'docker-compose.prod.yml', 'config'],
  { cwd: root, env, encoding: 'utf8', shell: false }
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'docker compose config failed');
  process.exit(result.status || 1);
}

const rendered = result.stdout || '';
// Compose v2+ merges env_file into environment in `config` output; assert SMTP is
// present from backend/.env (not from the shell, which we cleared above).
if (!/EMAIL_ENABLED:\s*["']?true["']?/i.test(rendered)) {
  console.error('expected EMAIL_ENABLED from backend/.env in rendered compose config');
  process.exit(1);
}
if (!/SMTP_HOST:\s*smtp\.example\.com/i.test(rendered)) {
  console.error('expected SMTP_HOST from backend/.env in rendered compose config');
  process.exit(1);
}

console.log('✓ docker-compose.prod.yml config smoke passed');
