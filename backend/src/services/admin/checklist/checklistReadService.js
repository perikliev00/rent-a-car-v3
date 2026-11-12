/**
 * Read-only checklist helpers: PDF download and fetch pickup/return rows.
 */
const pickupSql = require('../../sql/pickupChecklistSqlService');
// Require the '../../sql/returnChecklistSqlService' module as returnSql.
const returnSql = require('../../sql/returnChecklistSqlService');
// Require the '../../sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../sql/reservationSqlService');
// Destructure object properties into local variables.
const { generatePdf } = require('../../pdf/pdfDocumentService');

/**
 * Generate a reservation PDF of the requested kind (contract, checklist, etc.).
 * @param {number|string} reservationId
 * @param {string} kind
 */
async function downloadReservationPdf(reservationId, kind) {
  // Create the reservation constant.
  const reservation = await reservationSql.findById(reservationId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Create the err constant.
    const err = new Error('Reservation not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Return the resulting value to the caller.
  return generatePdf(kind, reservation);
}

/** @param {number|string} reservationId */
async function getChecklists(reservationId) {
  // Create the pickup checklist constant.
  const pickupChecklist = await pickupSql.findByReservationId(reservationId);
  // Create the return checklist constant.
  const returnChecklist = await returnSql.findByReservationId(reservationId);
  // Return the resulting value to the caller.
  return { pickupChecklist, returnChecklist };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  downloadReservationPdf,
  // Contribute this line to the enclosing declaration or statement.
  getChecklists,
};
