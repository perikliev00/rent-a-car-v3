const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

function readMigration(name) {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
}

describe('email verification migrations', () => {
  test('029 grandfathers only staff/admin, not all customers', () => {
    const sql = readMigration('029_email_verification.sql');

    expect(sql).toMatch(/role\s+IN\s*\(\s*'staff'\s*,\s*'admin'\s*\)/i);
    expect(sql).not.toMatch(
      /SET\s+email_verified_at\s*=\s*COALESCE\(created_at,\s*NOW\(\)\)\s*\nWHERE\s+email_verified_at\s+IS\s+NULL\s*;/i
    );
  });

  test('033 revokes created_at grandfather and unclaims unverified customer bookings', () => {
    const sql = readMigration('033_email_verification_legacy_cleanup.sql');

    expect(sql).toMatch(/email_verified_at\s*=\s*created_at/i);
    expect(sql).toMatch(/SET\s+email_verified_at\s*=\s*NULL/i);
    expect(sql).toMatch(/UPDATE\s+reservations/i);
    expect(sql).toMatch(/UPDATE\s+orders/i);
    expect(sql).toMatch(/u\.email_verified_at\s+IS\s+NULL/i);
    expect(sql).toMatch(/u\.role\s*=\s*'user'/i);
  });
});
