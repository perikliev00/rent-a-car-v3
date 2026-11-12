/**
 * Read the current session row for an open SSE connection.
 * A missing, expired, or logged-out row means the stream must stop.
 */

/**
 * @param {string|null|undefined} sessionId
 * @returns {Promise<{ valid: boolean, access?: object }>}
 */
async function lookupSessionAccess(sessionId) {
  if (!sessionId) return { valid: false };
  const pool = require('../../db/pool');
  const result = await pool.query('SELECT sess, expire FROM session WHERE sid = $1', [sessionId]);
  const row = result.rows[0];
  if (!row) return { valid: false };
  if (new Date(row.expire).getTime() <= Date.now()) return { valid: false };

  const sess = typeof row.sess === 'string' ? JSON.parse(row.sess) : row.sess;
  if (!sess || sess.isLoggedIn !== true || !sess.user) return { valid: false };

  const user = sess.user;
  return {
    valid: true,
    access: {
      userId: user.id != null ? String(user.id) : null,
      roles: Array.isArray(user.roles) ? user.roles : [],
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    },
  };
}

module.exports = { lookupSessionAccess };
