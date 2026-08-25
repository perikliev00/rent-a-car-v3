const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.join(__dirname, '../../../src');

function collectJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectJsFiles(full);
    }
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });
}

/**
 * Guards against the pre-hijacking regression: ownership must never again be assignable
 * from an email match alone. These assertions are deliberately structural so a
 * reintroduced helper, route, worker or alternate code path fails the suite.
 */
describe('email-based auto-claim is gone', () => {
  const sourceFiles = collectJsFiles(SRC_ROOT);

  test('the reservation SQL service exposes no claim-by-email helper', () => {
    const reservationSql = require('../../../src/services/sql/reservationSqlService');

    expect(reservationSql.claimByEmail).toBeUndefined();
    expect(Object.keys(reservationSql)).not.toContain('claimByEmail');
  });

  test('the reservation account repository exposes no claim-by-email helper', () => {
    const repo = require('../../../src/services/sql/reservation/reservationAccountRepository');

    expect(repo.claimByEmail).toBeUndefined();
  });

  test('the accountClaimService module no longer exists', () => {
    expect(() => require('../../../src/services/account/accountClaimService')).toThrow(
      /Cannot find module/,
    );
  });

  test('no source file references the removed claim helpers', () => {
    const offenders = sourceFiles.filter((file) => {
      const contents = fs.readFileSync(file, 'utf8');
      return (
        contents.includes('claimByEmail') ||
        contents.includes('claimReservationsForUser') ||
        contents.includes('accountClaimService')
      );
    });

    expect(offenders).toEqual([]);
  });

  test('no source file updates reservation or order ownership from an email match', () => {
    // The only permitted ownership writes are the id-scoped, token-gated ones in the
    // claim path. A `SET user_id` next to an email comparison is the exact shape of the
    // original vulnerability.
    const offenders = sourceFiles.filter((file) => {
      const contents = fs.readFileSync(file, 'utf8');
      const statements = contents.split(/;|`/);
      return statements.some(
        (statement) =>
          /UPDATE\s+(reservations|orders)/i.test(statement) &&
          /SET[\s\S]*user_id\s*=/i.test(statement) &&
          /LOWER\s*\(\s*email\s*\)|email\s*=\s*\$/i.test(statement),
      );
    });

    expect(offenders).toEqual([]);
  });

  test('the auth controller invokes no claim function on login or signup', () => {
    const contents = fs.readFileSync(
      path.join(SRC_ROOT, 'controllers/api/authController.js'),
      'utf8',
    );
    const withoutComments = contents
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(withoutComments).not.toMatch(/claim\w*\s*\(/i);
    expect(withoutComments).not.toMatch(/require\([^)]*[Cc]laim/);
  });

  test('ownership writes are guarded by an id and an existing-owner check', () => {
    const contents = fs.readFileSync(
      path.join(SRC_ROOT, 'services/sql/reservation/reservationAccountRepository.js'),
      'utf8',
    );

    expect(contents).toContain('WHERE id = $1');
    expect(contents).toContain('user_id IS NULL OR user_id = $2');
  });
});
