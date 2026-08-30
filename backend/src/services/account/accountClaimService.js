const userSql = require('../sql/userSqlService');
const reservationSql = require('../sql/reservationSqlService');

async function claimReservationsForUser(userId, email) {
  const user = await userSql.findUserById(userId);
  if (!user?.emailVerifiedAt) {
    return { reservations: 0, orders: 0, skipped: true };
  }

  return reservationSql.claimByEmail(userId, email || user.email);
}

module.exports = {
  claimReservationsForUser,
};
