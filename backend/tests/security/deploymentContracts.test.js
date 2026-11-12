const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  RUNTIME_ROLE_ATTRIBUTES,
  runtimePrivilegeStatements,
} = require('../../sql/ensureRuntimeRole');

const root = path.join(__dirname, '..', '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function workerBlock(compose) {
  const start = compose.indexOf('\n  worker:\n');
  if (start < 0) return '';
  const rest = compose.slice(start + 1);
  const next = rest.search(/\n  [a-z]/);
  return next < 0 ? rest : rest.slice(0, next);
}

describe('deployment security contracts', () => {
  test('dispatch image tags stay data and shell markers are not evaluated', () => {
    const workflow = read('.github/workflows/deploy.yml');
    expect(workflow).not.toContain('TAG="${{ inputs.image_tag }}"');
    expect(workflow).toContain('INPUT_IMAGE_TAG: ${{ inputs.image_tag }}');
    expect(workflow).toContain('node ops/resolve-image-tag.js');

    const malicious = spawnSync(process.execPath, [path.join(root, 'ops', 'resolve-image-tag.js')], {
      env: { ...process.env, INPUT_IMAGE_TAG: '$(printf pwned)' },
      encoding: 'utf8',
    });
    expect(malicious.status).toBe(1);
    expect(malicious.stdout).not.toContain('pwned');

    const valid = '0123456789abcdef0123456789abcdef01234567';
    const accepted = spawnSync(process.execPath, [path.join(root, 'ops', 'resolve-image-tag.js')], {
      env: { ...process.env, INPUT_IMAGE_TAG: valid },
      encoding: 'utf8',
    });
    expect(accepted.status).toBe(0);
    expect(accepted.stdout).toBe(valid);
  });

  test('privileged workflow actions are pinned to full commit SHAs', () => {
    for (const relativePath of [
      '.github/workflows/ci.yml',
      '.github/workflows/deploy.yml',
      '.github/workflows/aws-oidc-test.yml',
    ]) {
      const uses = read(relativePath).match(/uses:\s*\S+/g) || [];
      expect(uses.length).toBeGreaterThan(0);
      for (const entry of uses) {
        expect(entry).toMatch(/@[0-9a-f]{40}$/);
      }
    }
  });

  test('compose files separate runtime and migration database roles', () => {
    for (const relativePath of ['docker-compose.aws.yml', 'docker-compose.prod.yml']) {
      const compose = read(relativePath);
      expect(compose).toContain('postgres://luxride_app:');
      expect(compose).toContain('MIGRATION_DATABASE_URL: postgres://luxride:');
      expect(compose).toContain('SKIP_DB_SETUP: "true"');
      const worker = workerBlock(compose);
      expect(worker).toContain('SKIP_DB_SETUP');
      expect(worker).not.toContain('MIGRATION_DATABASE_URL');
      expect(worker).not.toMatch(/^ {6}APP_DB_PASSWORD:/m);
    }

    const entry = read('backend/docker-entrypoint.sh');
    const unsetAt = entry.indexOf('unset MIGRATION_DATABASE_URL');
    const execAt = entry.indexOf('exec "$@"');
    expect(entry).toContain('unset APP_DB_PASSWORD');
    expect(entry).toContain('unset POSTGRES_PASSWORD');
    expect(unsetAt).toBeGreaterThan(-1);
    expect(execAt).toBeGreaterThan(unsetAt);
    expect(entry).toContain('WAIT_DATABASE_URL="${MIGRATION_DATABASE_URL:-$RUNTIME_DATABASE_URL}"');

    expect(RUNTIME_ROLE_ATTRIBUTES).toContain('NOSUPERUSER');
    expect(RUNTIME_ROLE_ATTRIBUTES).toContain('NOCREATEDB');
    expect(RUNTIME_ROLE_ATTRIBUTES).toContain('NOCREATEROLE');
    const grants = runtimePrivilegeStatements('luxride').join('\n');
    expect(grants).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES');
    expect(grants).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE');
    expect(grants).toContain('public.schema_migrations');
    expect(grants).toContain('REVOKE CREATE ON SCHEMA public');
  });

  test('Grafana image is a patched release and dev servers are not published on all interfaces', () => {
    for (const relativePath of [
      'docker-compose.aws.yml',
      'docker-compose.prod.yml',
      'docker-compose.dev.yml',
    ]) {
      const compose = read(relativePath);
      expect(compose).toContain('grafana/grafana:13.2.4');
      expect(compose).not.toContain('grafana/grafana:11.4.0');
    }
    expect(read('docker-compose.aws.yml')).toContain('127.0.0.1:3001:3000');
    expect(read('docker-compose.aws.yml')).toContain('GF_USERS_ALLOW_SIGN_UP: "false"');
    expect(read('docker-compose.aws.yml')).toContain('GF_SECURITY_CONTENT_SECURITY_POLICY: "true"');
    expect(read('docker-compose.dev.yml')).toContain('GF_SECURITY_CONTENT_SECURITY_POLICY: "true"');

    const adminVite = read('admin-front-end/vite.config.ts');
    expect(adminVite).not.toMatch(/host:\s*true/);
    expect(adminVite).toContain("host: '127.0.0.1'");
    const devCompose = read('docker-compose.dev.yml');
    expect(devCompose).toContain('127.0.0.1:5173:5173');
    expect(devCompose).toContain('127.0.0.1:5174:5174');
    expect(devCompose).toContain('127.0.0.1:3001:3000');
  });
});
