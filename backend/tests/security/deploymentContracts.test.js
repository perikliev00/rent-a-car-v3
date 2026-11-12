// Destructure object properties into local variables.
const { spawnSync } = require('child_process');
// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  RUNTIME_ROLE_ATTRIBUTES,
  // Contribute this line to the enclosing declaration or statement.
  runtimePrivilegeStatements,
// Continue the surrounding logic with this statement.
} = require('../../sql/ensureRuntimeRole');

// Create the root constant.
const root = path.join(__dirname, '..', '..', '..');

// Define the read function.
function read(relativePath) {
  // Return the resulting value to the caller.
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

// Define the workerBlock function.
function workerBlock(compose) {
  // Create the start constant.
  const start = compose.indexOf('\n  worker:\n');
  // Evaluate the condition and enter the branch when it is true.
  if (start < 0) return '';
  // Create the rest constant.
  const rest = compose.slice(start + 1);
  // Create the next constant.
  const next = rest.search(/\n  [a-z]/);
  // Return the resulting value to the caller.
  return next < 0 ? rest : rest.slice(0, next);
}

// Declare a test suite grouping related cases.
describe('deployment security contracts', () => {
  // Define a single test case and its expectations.
  test('dispatch image tags stay data and shell markers are not evaluated', () => {
    // Create the workflow constant.
    const workflow = read('.github/workflows/deploy.yml');
    // Assert that the value matches the intended expectation.
    expect(workflow).not.toContain('TAG="${{ inputs.image_tag }}"');
    // Assert that the value matches the intended expectation.
    expect(workflow).toContain('INPUT_IMAGE_TAG: ${{ inputs.image_tag }}');
    // Assert that the value matches the intended expectation.
    expect(workflow).toContain('node ops/resolve-image-tag.js');

    // Create the malicious constant.
    const malicious = spawnSync(process.execPath, [path.join(root, 'ops', 'resolve-image-tag.js')], {
      // Provide the env field value.
      env: { ...process.env, INPUT_IMAGE_TAG: '$(printf pwned)' },
      // Provide the encoding field value.
      encoding: 'utf8',
    });
    // Assert that the value matches the intended expectation.
    expect(malicious.status).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(malicious.stdout).not.toContain('pwned');

    // Create the valid constant.
    const valid = '0123456789abcdef0123456789abcdef01234567';
    // Create the accepted constant.
    const accepted = spawnSync(process.execPath, [path.join(root, 'ops', 'resolve-image-tag.js')], {
      // Provide the env field value.
      env: { ...process.env, INPUT_IMAGE_TAG: valid },
      // Provide the encoding field value.
      encoding: 'utf8',
    });
    // Assert that the value matches the intended expectation.
    expect(accepted.status).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(accepted.stdout).toBe(valid);
  });

  // Define a single test case and its expectations.
  test('privileged workflow actions are pinned to full commit SHAs', () => {
    // Iterate using the loop initializer, condition, and step.
    for (const relativePath of [
      // Supply the literal value used by the enclosing expression.
      '.github/workflows/ci.yml',
      // Supply the literal value used by the enclosing expression.
      '.github/workflows/deploy.yml',
      // Supply the literal value used by the enclosing expression.
      '.github/workflows/aws-oidc-test.yml',
    // Continue the surrounding logic with this statement.
    ]) {
      // Create the uses constant.
      const uses = read(relativePath).match(/uses:\s*\S+/g) || [];
      // Assert that the value matches the intended expectation.
      expect(uses.length).toBeGreaterThan(0);
      // Iterate using the loop initializer, condition, and step.
      for (const entry of uses) {
        // Assert that the value matches the intended expectation.
        expect(entry).toMatch(/@[0-9a-f]{40}$/);
      }
    }
  });

  // Define a single test case and its expectations.
  test('compose files separate runtime and migration database roles', () => {
    // Iterate using the loop initializer, condition, and step.
    for (const relativePath of ['docker-compose.aws.yml', 'docker-compose.prod.yml']) {
      // Create the compose constant.
      const compose = read(relativePath);
      // Assert that the value matches the intended expectation.
      expect(compose).toContain('postgres://luxride_app:');
      // Assert that the value matches the intended expectation.
      expect(compose).toContain('MIGRATION_DATABASE_URL: postgres://luxride:');
      // Assert that the value matches the intended expectation.
      expect(compose).toContain('SKIP_DB_SETUP: "true"');
      // Create the worker constant.
      const worker = workerBlock(compose);
      // Assert that the value matches the intended expectation.
      expect(worker).toContain('SKIP_DB_SETUP');
      // Assert that the value matches the intended expectation.
      expect(worker).not.toContain('MIGRATION_DATABASE_URL');
      // Assert that the value matches the intended expectation.
      expect(worker).not.toMatch(/^ {6}APP_DB_PASSWORD:/m);
    }

    // Create the entry constant.
    const entry = read('backend/docker-entrypoint.sh');
    // Create the unset at constant.
    const unsetAt = entry.indexOf('unset MIGRATION_DATABASE_URL');
    // Create the exec at constant.
    const execAt = entry.indexOf('exec "$@"');
    // Assert that the value matches the intended expectation.
    expect(entry).toContain('unset APP_DB_PASSWORD');
    // Assert that the value matches the intended expectation.
    expect(entry).toContain('unset POSTGRES_PASSWORD');
    // Assert that the value matches the intended expectation.
    expect(unsetAt).toBeGreaterThan(-1);
    // Assert that the value matches the intended expectation.
    expect(execAt).toBeGreaterThan(unsetAt);
    // Assert that the value matches the intended expectation.
    expect(entry).toContain('WAIT_DATABASE_URL="${MIGRATION_DATABASE_URL:-$RUNTIME_DATABASE_URL}"');

    // Assert that the value matches the intended expectation.
    expect(RUNTIME_ROLE_ATTRIBUTES).toContain('NOSUPERUSER');
    // Assert that the value matches the intended expectation.
    expect(RUNTIME_ROLE_ATTRIBUTES).toContain('NOCREATEDB');
    // Assert that the value matches the intended expectation.
    expect(RUNTIME_ROLE_ATTRIBUTES).toContain('NOCREATEROLE');
    // Create the grants constant.
    const grants = runtimePrivilegeStatements('luxride').join('\n');
    // Assert that the value matches the intended expectation.
    expect(grants).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES');
    // Assert that the value matches the intended expectation.
    expect(grants).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE');
    // Assert that the value matches the intended expectation.
    expect(grants).toContain('public.schema_migrations');
    // Assert that the value matches the intended expectation.
    expect(grants).toContain('REVOKE CREATE ON SCHEMA public');
  });

  // Define a single test case and its expectations.
  test('Grafana image is a patched release and dev servers are not published on all interfaces', () => {
    // Iterate using the loop initializer, condition, and step.
    for (const relativePath of [
      // Supply the literal value used by the enclosing expression.
      'docker-compose.aws.yml',
      // Supply the literal value used by the enclosing expression.
      'docker-compose.prod.yml',
      // Supply the literal value used by the enclosing expression.
      'docker-compose.dev.yml',
    // Continue the surrounding logic with this statement.
    ]) {
      // Create the compose constant.
      const compose = read(relativePath);
      // Assert that the value matches the intended expectation.
      expect(compose).toContain('grafana/grafana:13.2.4');
      // Assert that the value matches the intended expectation.
      expect(compose).not.toContain('grafana/grafana:11.4.0');
    }
    // Assert that the value matches the intended expectation.
    expect(read('docker-compose.aws.yml')).toContain('127.0.0.1:3001:3000');
    // Assert that the value matches the intended expectation.
    expect(read('docker-compose.aws.yml')).toContain('GF_USERS_ALLOW_SIGN_UP: "false"');
    // Assert that the value matches the intended expectation.
    expect(read('docker-compose.aws.yml')).toContain('GF_SECURITY_CONTENT_SECURITY_POLICY: "true"');
    // Assert that the value matches the intended expectation.
    expect(read('docker-compose.dev.yml')).toContain('GF_SECURITY_CONTENT_SECURITY_POLICY: "true"');

    // Create the admin vite constant.
    const adminVite = read('admin-front-end/vite.config.ts');
    // Assert that the value matches the intended expectation.
    expect(adminVite).not.toMatch(/host:\s*true/);
    // Assert that the value matches the intended expectation.
    expect(adminVite).toContain("host: '127.0.0.1'");
    // Create the dev compose constant.
    const devCompose = read('docker-compose.dev.yml');
    // Assert that the value matches the intended expectation.
    expect(devCompose).toContain('127.0.0.1:5173:5173');
    // Assert that the value matches the intended expectation.
    expect(devCompose).toContain('127.0.0.1:5174:5174');
    // Assert that the value matches the intended expectation.
    expect(devCompose).toContain('127.0.0.1:3001:3000');
  });
});
