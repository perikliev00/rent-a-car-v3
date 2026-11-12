/**
 * Shared session advisory lock for schema apply + migrations.
 * Prevents interleaved db:setup when multiple app containers start together.
 */
const LOCK_SQL = `SELECT pg_advisory_lock(hashtext('luxride_migrations'))`;
const UNLOCK_SQL = `SELECT pg_advisory_unlock(hashtext('luxride_migrations'))`;

/**
 * Blocking session-level lock shared by applySchema and migrate.
 * @param {import('pg').PoolClient} client
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function acquireDbSetupLock(client) {
  await client.query(LOCK_SQL);
}

/**
 * @param {import('pg').PoolClient} client
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function releaseDbSetupLock(client) {
  await client.query(UNLOCK_SQL);
}

module.exports = {
  acquireDbSetupLock,
  releaseDbSetupLock,
};
