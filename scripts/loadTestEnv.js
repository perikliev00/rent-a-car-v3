const fs = require('fs');
const path = require('path');

const TEST_ENV_PATH = path.resolve(__dirname, '..', '.env.test');

function loadTestEnv() {
  if (!fs.existsSync(TEST_ENV_PATH)) {
    return { loaded: false, path: TEST_ENV_PATH };
  }

  const text = fs.readFileSync(TEST_ENV_PATH, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }

  return { loaded: true, path: TEST_ENV_PATH };
}

function requireTestDatabaseUrl(commandLabel) {
  loadTestEnv();
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  console.error(
    `${commandLabel}: missing DATABASE_URL.\n` +
      `Copy .env.test.example to .env.test and set a dedicated test database (luxride_test), not rent_a_car.`
  );
  process.exit(1);
}

module.exports = { loadTestEnv, requireTestDatabaseUrl, TEST_ENV_PATH };
