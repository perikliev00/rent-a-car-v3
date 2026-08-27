/**
 * Compatibility shim for older test setup files.
 *
 * Email/password authentication is not proof of ownership of a guest booking. This
 * function intentionally performs no database work; a future explicit claim flow must
 * use separate proof such as a single-use token delivered to the booking email.
 */
async function claimReservationsForUser() {
  return { reservations: 0, orders: 0 };
}

module.exports = {
  claimReservationsForUser,
};
