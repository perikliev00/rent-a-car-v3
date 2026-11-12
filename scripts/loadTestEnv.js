/**
 * Load `.env.test` into `process.env` for test/CI database commands.
 * Existing non-empty env vars are left unchanged (do not override).
 */

const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');

// Create the test env path constant.
const TEST_ENV_PATH = path.resolve(__dirname, '..', '.env.test');

/**
 * Parse KEY=VALUE lines from `.env.test` into process.env.
 * @returns {{ loaded: boolean, path: string }}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function loadTestEnv() {
  // Evaluate the condition and enter the branch when it is true.
  if (!fs.existsSync(TEST_ENV_PATH)) {
    // Return the resulting value to the caller.
    return { loaded: false, path: TEST_ENV_PATH };
  }

  // Create the text constant.
  const text = fs.readFileSync(TEST_ENV_PATH, 'utf8');
  // Iterate using the loop initializer, condition, and step.
  for (const rawLine of text.split(/\r?\n/)) {
    // Create the line constant.
    const line = rawLine.trim();
    // Evaluate the condition and enter the branch when it is true.
    if (!line || line.startsWith('#')) continue;
    // Create the eq constant.
    const eq = line.indexOf('=');
    // Evaluate the condition and enter the branch when it is true.
    if (eq <= 0) continue;
    // Create the key constant.
    const key = line.slice(0, eq).trim();
    // Initialize the mutable value variable.
    let value = line.slice(eq + 1).trim();
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Continue the surrounding logic with this statement.
      (value.startsWith('"') && value.endsWith('"')) ||
      // Continue the surrounding logic with this statement.
      (value.startsWith("'") && value.endsWith("'"))
    // Continue the surrounding logic with this statement.
    ) {
      // Update value with the right-hand side value.
      value = value.slice(1, -1);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (process.env[key] === undefined || process.env[key] === '') {
      // Update process.env[key] with the right-hand side value.
      process.env[key] = value;
    }
  }

  // Return the resulting value to the caller.
  return { loaded: true, path: TEST_ENV_PATH };
}

/**
 * Ensure DATABASE_URL is set (after loading `.env.test`), else exit with guidance.
 *
 * @param {string} commandLabel - Shown in the error message (e.g. npm script name)
 * @returns {string}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function requireTestDatabaseUrl(commandLabel) {
  // Call loadTestEnv to perform this step.
  loadTestEnv();
  // Evaluate the condition and enter the branch when it is true.
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Emit a diagnostic log message.
  console.error(
    // Continue the surrounding logic with this statement.
    `${commandLabel}: missing DATABASE_URL.\n` +
      // Continue the surrounding logic with this statement.
      `Copy .env.test.example to .env.test and set a dedicated test database (luxride_test), not rent_a_car.`
  );
  // Call process.exit to perform this step.
  process.exit(1);
}

// Assign the CommonJS module exports.
module.exports = { loadTestEnv, requireTestDatabaseUrl, TEST_ENV_PATH };
