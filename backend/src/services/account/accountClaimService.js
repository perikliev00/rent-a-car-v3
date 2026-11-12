/**
 * Attach guest reservations (matched by email) to a verified user account.
 * No-op until the user has verified their email (prevents hijacking unverified claims).
 */
const userSql = require('../sql/userSqlService');
// Require the '../sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../sql/reservationSqlService');

/**
 * Claim reservations/orders for a verified user by email.
 *
 * @param {string|number} userId
 * @param {string} [email]
 * @returns {Promise<{ reservations: number, orders: number, skipped?: boolean }>}
 */
async function claimReservationsForUser(userId, email) {
  // Create the user constant.
  const user = await userSql.findUserById(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!user?.emailVerifiedAt) {
    // Return the resulting value to the caller.
    return { reservations: 0, orders: 0, skipped: true };
  }

  // Return the resulting value to the caller.
  return reservationSql.claimByEmail(userId, email || user.email);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  claimReservationsForUser,
};
