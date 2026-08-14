const reservationSql = require('../sql/reservationSqlService');

async function claimReservationsForUser(userId, email) {
  return reservationSql.claimByEmail(userId, email);
}

module.exports = {
  claimReservationsForUser,
};
