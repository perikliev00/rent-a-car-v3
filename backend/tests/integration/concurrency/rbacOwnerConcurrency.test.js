/**
 * B4: two concurrent owner demotions must never leave the system with zero owners.
 */
const { pool } = require('../../helpers/dbTestHarness');
const {
  DEFAULT_ADMIN,
  insertTestAdmin,
  insertTestStaff,
  cleanupTestStaff,
  getRoleBySlug,
} = require('../helpers/dbFixtures');
const rbacService = require('../../../src/services/rbac/rbacService');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

async function countOwners() {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.slug = 'owner'
    `
  );
  return result.rows[0].count;
}

/**
 * Hold SHARE ROW EXCLUSIVE on user_roles: owner-count SELECTs still run, but the DELETE that
 * actually demotes a user blocks. Both requests therefore pass the "is there another owner?"
 * check before either can write.
 */
async function runWithWriteBarrier(startA, startB) {
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query('LOCK TABLE user_roles IN SHARE ROW EXCLUSIVE MODE');

    const settled = [Promise.resolve().then(startA), Promise.resolve().then(startB)].map((p) =>
      p.then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason })
      )
    );

    const started = Date.now();
    let blocked = 0;
    while (Date.now() - started < 10_000 && blocked < 1) {
      const r = await pool.query(
        `
        SELECT COUNT(*)::int AS n
        FROM pg_locks
        WHERE locktype = 'relation'
          AND granted = false
          AND relation = 'user_roles'::regclass
        `
      );
      blocked = r.rows[0].n;
      if (blocked < 1) await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(blocked).toBeGreaterThanOrEqual(1);
    // Let the other request reach the same point (or queue behind a serialization lock).
    await new Promise((resolve) => setTimeout(resolve, 750));

    await holder.query('COMMIT');
    return await Promise.all(settled);
  } finally {
    try {
      await holder.query('ROLLBACK');
    } catch {
      // already committed
    }
    holder.release();
  }
}

describeIf('B4: rbacOwnerConcurrency', () => {
  jest.setTimeout(60_000);

  let ownerRole;
  let supportRole;
  let adminUserId;
  let second;
  let displacedOwnerRows = [];

  beforeEach(async () => {
    adminUserId = await insertTestAdmin();
    ownerRole = await getRoleBySlug('owner');
    supportRole = await getRoleBySlug('support');

    // Exactly two owners: the default admin + one fresh staff owner. Remember who we displace.
    const others = await pool.query(
      `DELETE FROM user_roles WHERE role_id = $1 AND user_id <> $2 RETURNING user_id, role_id`,
      [ownerRole.id, adminUserId]
    );
    displacedOwnerRows = others.rows;
    second = await insertTestStaff({ roleSlug: 'owner' });
    expect(await countOwners()).toBe(2);
  });

  afterEach(async () => {
    // Restore owners first so cleanup guards (never delete last owner) are satisfied.
    await insertTestAdmin();
    await cleanupTestStaff(second.email).catch(() => undefined);
    for (const row of displacedOwnerRows) {
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [row.user_id, row.role_id]
      );
    }
    expect(await countOwners()).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_ADMIN.email).toBeTruthy();
  });

  test('control: sequential demotion of both owners is refused for the last one', async () => {
    await rbacService.setUserRoles(second.userId, [supportRole.id]);
    await expect(
      rbacService.setUserRoles(adminUserId, [supportRole.id])
    ).rejects.toMatchObject({ code: 'LAST_OWNER' });
    expect(await countOwners()).toBe(1);
  });

  test('concurrent setUserRoles demoting both owners leaves at least one owner', async () => {
    const results = await runWithWriteBarrier(
      () => rbacService.setUserRoles(adminUserId, [supportRole.id]),
      () => rbacService.setUserRoles(second.userId, [supportRole.id])
    );

    expect(await countOwners()).toBeGreaterThanOrEqual(1);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected.length).toBeGreaterThanOrEqual(1);
    for (const r of rejected) {
      expect(r.reason).toMatchObject({ code: 'LAST_OWNER' });
    }
  });

  test('concurrent revokeUserRole(owner) on both owners leaves at least one owner', async () => {
    const results = await runWithWriteBarrier(
      () => rbacService.revokeUserRole(adminUserId, ownerRole.id),
      () => rbacService.revokeUserRole(second.userId, ownerRole.id)
    );

    expect(await countOwners()).toBeGreaterThanOrEqual(1);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected.length).toBeGreaterThanOrEqual(1);
    for (const r of rejected) {
      expect(r.reason).toMatchObject({ code: 'LAST_OWNER' });
    }
  });

  test('concurrent setUserRoles + revokeUserRole across the two owners leaves at least one owner', async () => {
    await runWithWriteBarrier(
      () => rbacService.setUserRoles(adminUserId, [supportRole.id]),
      () => rbacService.revokeUserRole(second.userId, ownerRole.id)
    );
    expect(await countOwners()).toBeGreaterThanOrEqual(1);
  });
});
