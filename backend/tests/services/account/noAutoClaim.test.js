const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.join(__dirname, '../../../src');
const LEGACY_SHIM = path.join(
  SRC_ROOT,
  'services/account/accountClaimService.js',
);

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
 * Prevents the account pre-hijacking regression. Authentication by password must never
 * assign reservation or order ownership from an email match alone.
 */
describe('email-based automatic booking claim is disabled', () => {
  const sourceFiles = collectJsFiles(SRC_ROOT);

  test('reservation SQL exposes no claim-by-email helper', () => {
    const reservationSql = require('../../../src/services/sql/reservationSqlService');
    const accountRepository = require('../../../src/services/sql/reservation/reservationAccountRepository');

    expect(reservationSql.claimByEmail).toBeUndefined();
    expect(accountRepository.claimByEmail).toBeUndefined();
  });

  test('the legacy claim service is an inert compatibility shim', async () => {
    const { claimReservationsForUser } = require('../../../src/services/account/accountClaimService');

    await expect(
      claimReservationsForUser(42, 'victim@example.com'),
    ).resolves.toEqual({ reservations: 0, orders: 0 });
  });

  test('no production source outside the shim references email-claim helpers', () => {
    const offenders = sourceFiles
      .filter((file) => file !== LEGACY_SHIM)
      .filter((file) => {
        const contents = fs.readFileSync(file, 'utf8');
        return (
          contents.includes('claimByEmail') ||
          contents.includes('claimReservationsForUser') ||
          contents.includes('accountClaimService')
        );
      });

    expect(offenders).toEqual([]);
  });

  test('no source SQL assigns booking ownership from an email comparison', () => {
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

  test('login and signup invoke no ownership claim function', () => {
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
});
