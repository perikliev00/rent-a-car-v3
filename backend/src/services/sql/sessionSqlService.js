/**
 * Express-session table helpers: ensure schema, list active sids, delete by sid.
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Ensure session table exists or is initialized.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function ensureSessionTable(client = null) {
  // Create the existing constant.
  const existing = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'session'
    LIMIT 1
    `
  );
  // The runtime role must not need CREATE. Schema/migrations own this table.
  if (existing.rowCount > 0) return;

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    CREATE TABLE IF NOT EXISTS session (
      sid    VARCHAR     NOT NULL PRIMARY KEY,
      sess   JSON        NOT NULL,
      expire TIMESTAMPTZ NOT NULL
    )
    `
  );

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire)
    `
  );
}

/**
 * List active session ids from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listActiveSessionIds(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT sid
    FROM session
    WHERE expire > NOW()
    `
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => String(row.sid));
}

/**
 * Close in-process SSE subscribers for a user whose session rows were removed.
 * Other API processes observe the deletion on their next stream revalidation.
 * @param {string|number} userId
 */
function notifySessionRevocation(userId) {
  // Evaluate the condition and enter the branch when it is true.
  if (userId == null || userId === '') return;
  // Start a try block for operations that may fail.
  try {
    // Require the '../../modules/realtime/realtime.hub' module as hub.
    const hub = require('../../modules/realtime/realtime.hub');
    // Call hub.revokeUser to perform this step.
    hub.revokeUser(userId);
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Realtime is optional while the process is still booting.
  }
}

/** Destroy connect-pg-simple sessions for a user (id stored as string or number in sess.user). */
async function destroySessionsForUser(userId, client = null) {
  // Create the id constant.
  const id = String(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!id || id === 'undefined' || id === 'null') return 0;

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM session
    WHERE sess->'user'->>'id' = $1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Call notifySessionRevocation to perform this step.
  notifySessionRevocation(id);
  // Return the resulting value to the caller.
  return result.rowCount || 0;
}

/** Destroy sessions for every user currently assigned the given role. */
async function destroySessionsForRole(roleId, client = null) {
  // Create the id constant.
  const id = Number(roleId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) return 0;

  // Create the assigned constant.
  const assigned = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `SELECT user_id FROM user_roles WHERE role_id = $1`,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM session
    WHERE (sess->'user'->>'id')::bigint IN (
      SELECT user_id FROM user_roles WHERE role_id = $1
    )
    `,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Iterate using the loop initializer, condition, and step.
  for (const row of assigned.rows) {
    // Call notifySessionRevocation to perform this step.
    notifySessionRevocation(row.user_id);
  }
  // Return the resulting value to the caller.
  return result.rowCount || 0;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ensureSessionTable,
  // Contribute this line to the enclosing declaration or statement.
  listActiveSessionIds,
  // Contribute this line to the enclosing declaration or statement.
  destroySessionsForUser,
  // Contribute this line to the enclosing declaration or statement.
  destroySessionsForRole,
};
