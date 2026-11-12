// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const { hasAppliedMigrations, applyFreshSchemaIfNeeded } = require('../../sql/applySchema');

// Create the repo root constant.
const repoRoot = path.join(__dirname, '..', '..', '..');

// Define the clientWithLedger function.
function clientWithLedger(hasRows) {
  // Return the resulting value to the caller.
  return {
    // Provide the query field value.
    query: jest.fn(async (sql) => {
      // Evaluate the condition and enter the branch when it is true.
      if (String(sql).includes('information_schema.tables')) {
        // Return the resulting value to the caller.
        return { rows: [{ present: true }], rowCount: 1 };
      }
      // Evaluate the condition and enter the branch when it is true.
      if (String(sql).includes('schema_migrations')) {
        // Return the resulting value to the caller.
        return hasRows ? { rows: [{ '?column?': 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      // Return the resulting value to the caller.
      return { rows: [], rowCount: 0 };
    }),
  };
}

// Declare a test suite grouping related cases.
describe('fresh schema seed', () => {
  // Define a single test case and its expectations.
  test('skips schema files when migrations have already been applied', async () => {
    // Create the client constant.
    const client = clientWithLedger(true);
    // Create the read schema files constant.
    const readSchemaFiles = jest.fn(() => [{ name: '027_rbac.sql', sql: 'INSERT INTO role_permissions' }]);

    // Create the result constant.
    const result = await applyFreshSchemaIfNeeded(client, { readSchemaFiles });

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ skipped: true, applied: 0 });
    // Assert that the value matches the intended expectation.
    expect(readSchemaFiles).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(await hasAppliedMigrations(client)).toBe(true);
  });

  // Define a single test case and its expectations.
  test('applies schema files only for a database without a migration ledger row', async () => {
    // Create the client constant.
    const client = clientWithLedger(false);
    // Create the read schema files constant.
    const readSchemaFiles = jest.fn(() => [{ name: '001_categories.sql', sql: 'SELECT 1' }]);

    // Create the result constant.
    const result = await applyFreshSchemaIfNeeded(client, { readSchemaFiles });

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ skipped: false, applied: 1 });
    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith('SELECT 1');
  });

  // Define a single test case and its expectations.
  test('fresh RBAC seed does not grant reservation ops to driver', () => {
    // Create the schema constant.
    const schema = fs.readFileSync(
      // Call path.join to perform this step.
      path.join(repoRoot, 'backend', 'sql', 'schema', '027_rbac.sql'),
      // Supply the literal value used by the enclosing expression.
      'utf8'
    );
    // Assert that the value matches the intended expectation.
    expect(schema).not.toMatch(/WHERE r\.slug = 'driver'/);
  });

  // Define a single test case and its expectations.
  test('reconciliation migration removes the driver ops grant and driver sessions', () => {
    // Create the migration constant.
    const migration = fs.readFileSync(
      // Call path.join to perform this step.
      path.join(repoRoot, 'backend', 'migrations', '036_driver_ops_permission_reconcile.sql'),
      // Supply the literal value used by the enclosing expression.
      'utf8'
    );
    // Assert that the value matches the intended expectation.
    expect(migration).toMatch(/DELETE FROM role_permissions/);
    // Assert that the value matches the intended expectation.
    expect(migration).toMatch(/r\.slug = 'driver'/);
    // Assert that the value matches the intended expectation.
    expect(migration).toMatch(/can_view_reservations_ops/);
    // Assert that the value matches the intended expectation.
    expect(migration).toMatch(/DELETE FROM session/);
    // Assert that the value matches the intended expectation.
    expect(migration).not.toMatch(/INSERT INTO role_permissions/);
  });
});
