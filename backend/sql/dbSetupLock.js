/**
 * Shared session advisory lock for schema apply + migrations.
 * Prevents interleaved db:setup when multiple app containers start together.
 */
const LOCK_SQL = `SELECT pg_advisory_lock(hashtext('luxride_migrations'))`;
// Create the unlock sql constant.
const UNLOCK_SQL = `SELECT pg_advisory_unlock(hashtext('luxride_migrations'))`;

/**
 * Blocking session-level lock shared by applySchema and migrate.
 * @param {import('pg').PoolClient} client
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function acquireDbSetupLock(client) {
  // Wait until the asynchronous operation resolves.
  await client.query(LOCK_SQL);
}

/**
 * @param {import('pg').PoolClient} client
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function releaseDbSetupLock(client) {
  // Wait until the asynchronous operation resolves.
  await client.query(UNLOCK_SQL);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  acquireDbSetupLock,
  // Contribute this line to the enclosing declaration or statement.
  releaseDbSetupLock,
};
