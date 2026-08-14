const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
   .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

async function getMigrationStatus(pool) {
  const expected = listMigrationFiles();

  let applied = [];
  try {
    const result = await pool.query('SELECT name FROM schema_migrations ORDER BY name');
    applied = result.rows.map((row) => row.name);
  } catch (err) {
    if (err.code === '42P01') {
      return {
        ok: false,
        expected,
        applied: [],
        pending: expected,
        error: 'schema_migrations table missing',
      };
    }
    throw err;
  }

  const appliedSet = new Set(applied);
  const pending = expected.filter((file) => !appliedSet.has(file));

  return {
    ok: pending.length === 0,
    expected,
    applied,
    pending,
  };
}

module.exports = {
  getMigrationStatus,
  listMigrationFiles,
};
