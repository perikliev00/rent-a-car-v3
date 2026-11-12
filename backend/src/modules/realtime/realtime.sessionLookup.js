/**
 * Read the current session row for an open SSE connection.
 * A missing, expired, or logged-out row means the stream must stop.
 */

/**
 * @param {string|null|undefined} sessionId
 * @returns {Promise<{ valid: boolean, access?: object }>}
 */
async function lookupSessionAccess(sessionId) {
  // Evaluate the condition and enter the branch when it is true.
  if (!sessionId) return { valid: false };
  // Require the '../../db/pool' module as pool.
  const pool = require('../../db/pool');
  // Create the result constant.
  const result = await pool.query('SELECT sess, expire FROM session WHERE sid = $1', [sessionId]);
  // Create the row constant.
  const row = result.rows[0];
  // Evaluate the condition and enter the branch when it is true.
  if (!row) return { valid: false };
  // Evaluate the condition and enter the branch when it is true.
  if (new Date(row.expire).getTime() <= Date.now()) return { valid: false };

  // Create the sess constant.
  const sess = typeof row.sess === 'string' ? JSON.parse(row.sess) : row.sess;
  // Evaluate the condition and enter the branch when it is true.
  if (!sess || sess.isLoggedIn !== true || !sess.user) return { valid: false };

  // Create the user constant.
  const user = sess.user;
  // Return the resulting value to the caller.
  return {
    // Provide the valid field value.
    valid: true,
    // Provide the access field value.
    access: {
      // Provide the user id field value.
      userId: user.id != null ? String(user.id) : null,
      // Provide the roles field value.
      roles: Array.isArray(user.roles) ? user.roles : [],
      // Provide the permissions field value.
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    },
  };
}

// Assign the CommonJS module exports.
module.exports = { lookupSessionAccess };
