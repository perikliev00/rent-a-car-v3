const fs = require('fs');
const path = require('path');
const { hasAppliedMigrations, applyFreshSchemaIfNeeded } = require('../../sql/applySchema');

const repoRoot = path.join(__dirname, '..', '..', '..');

function clientWithLedger(hasRows) {
  return {
    query: jest.fn(async (sql) => {
      if (String(sql).includes('information_schema.tables')) {
        return { rows: [{ present: true }], rowCount: 1 };
      }
      if (String(sql).includes('schema_migrations')) {
        return hasRows ? { rows: [{ '?column?': 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

describe('fresh schema seed', () => {
  test('skips schema files when migrations have already been applied', async () => {
    const client = clientWithLedger(true);
    const readSchemaFiles = jest.fn(() => [{ name: '027_rbac.sql', sql: 'INSERT INTO role_permissions' }]);

    const result = await applyFreshSchemaIfNeeded(client, { readSchemaFiles });

    expect(result).toEqual({ skipped: true, applied: 0 });
    expect(readSchemaFiles).not.toHaveBeenCalled();
    expect(await hasAppliedMigrations(client)).toBe(true);
  });

  test('applies schema files only for a database without a migration ledger row', async () => {
    const client = clientWithLedger(false);
    const readSchemaFiles = jest.fn(() => [{ name: '001_categories.sql', sql: 'SELECT 1' }]);

    const result = await applyFreshSchemaIfNeeded(client, { readSchemaFiles });

    expect(result).toEqual({ skipped: false, applied: 1 });
    expect(client.query).toHaveBeenCalledWith('SELECT 1');
  });

  test('fresh RBAC seed does not grant reservation ops to driver', () => {
    const schema = fs.readFileSync(
      path.join(repoRoot, 'backend', 'sql', 'schema', '027_rbac.sql'),
      'utf8'
    );
    expect(schema).not.toMatch(/WHERE r\.slug = 'driver'/);
  });

  test('reconciliation migration removes the driver ops grant and driver sessions', () => {
    const migration = fs.readFileSync(
      path.join(repoRoot, 'backend', 'migrations', '036_driver_ops_permission_reconcile.sql'),
      'utf8'
    );
    expect(migration).toMatch(/DELETE FROM role_permissions/);
    expect(migration).toMatch(/r\.slug = 'driver'/);
    expect(migration).toMatch(/can_view_reservations_ops/);
    expect(migration).toMatch(/DELETE FROM session/);
    expect(migration).not.toMatch(/INSERT INTO role_permissions/);
  });
});
