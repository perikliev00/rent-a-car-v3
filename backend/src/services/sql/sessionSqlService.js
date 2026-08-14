const { clientQuery } = require('../../db/transaction');

async function ensureSessionTable(client = null) {
  await clientQuery(
    client,
    `
    CREATE TABLE IF NOT EXISTS session (
      sid    VARCHAR     NOT NULL PRIMARY KEY,
      sess   JSON        NOT NULL,
      expire TIMESTAMPTZ NOT NULL
    )
    `
  );

  await clientQuery(
    client,
    `
    CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire)
    `
  );
}

async function listActiveSessionIds(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT sid
    FROM session
    WHERE expire > NOW()
    `
  );

  return result.rows.map((row) => String(row.sid));
}

/** Destroy connect-pg-simple sessions for a user (id stored as string or number in sess.user). */
async function destroySessionsForUser(userId, client = null) {
  const id = String(userId);
  if (!id || id === 'undefined' || id === 'null') return 0;

  const result = await clientQuery(
    client,
    `
    DELETE FROM session
    WHERE sess->'user'->>'id' = $1
    `,
    [id]
  );
  return result.rowCount || 0;
}

/** Destroy sessions for every user currently assigned the given role. */
async function destroySessionsForRole(roleId, client = null) {
  const id = Number(roleId);
  if (!Number.isInteger(id) || id <= 0) return 0;

  const result = await clientQuery(
    client,
    `
    DELETE FROM session
    WHERE (sess->'user'->>'id')::bigint IN (
      SELECT user_id FROM user_roles WHERE role_id = $1
    )
    `,
    [id]
  );
  return result.rowCount || 0;
}

module.exports = {
  ensureSessionTable,
  listActiveSessionIds,
  destroySessionsForUser,
  destroySessionsForRole,
};
