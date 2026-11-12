/**
 * Compare filesystem SQL migrations against the `schema_migrations` table.
 */

const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');

// Create the migrations dir constant.
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

/**
 * Sorted list of `*.sql` filenames under backend/migrations.
 * @returns {string[]}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function listMigrationFiles() {
  // Evaluate the condition and enter the branch when it is true.
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    // Return the resulting value to the caller.
    return [];
  }

  // Return the resulting value to the caller.
  return fs
   // Call .readdirSync to perform this step.
   .readdirSync(MIGRATIONS_DIR)
    // Call .filter to perform this step.
    .filter((name) => name.endsWith('.sql'))
    // Call .sort to perform this step.
    .sort();
}

/**
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ ok: boolean, expected: string[], applied: string[], pending: string[], error?: string }>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function getMigrationStatus(pool) {
  // Create the expected constant.
  const expected = listMigrationFiles();

  // Initialize the mutable applied variable.
  let applied = [];
  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await pool.query('SELECT name FROM schema_migrations ORDER BY name');
    // Update applied with the right-hand side value.
    applied = result.rows.map((row) => row.name);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === '42P01') {
      // Return the resulting value to the caller.
      return {
        // Provide the ok field value.
        ok: false,
        // Contribute this line to the enclosing declaration or statement.
        expected,
        // Provide the applied field value.
        applied: [],
        // Provide the pending field value.
        pending: expected,
        // Provide the error field value.
        error: 'schema_migrations table missing',
      };
    }
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the applied set constant.
  const appliedSet = new Set(applied);
  // Create the pending constant.
  const pending = expected.filter((file) => !appliedSet.has(file));

  // Return the resulting value to the caller.
  return {
    // Provide the ok field value.
    ok: pending.length === 0,
    // Contribute this line to the enclosing declaration or statement.
    expected,
    // Contribute this line to the enclosing declaration or statement.
    applied,
    // Contribute this line to the enclosing declaration or statement.
    pending,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getMigrationStatus,
  // Contribute this line to the enclosing declaration or statement.
  listMigrationFiles,
};
