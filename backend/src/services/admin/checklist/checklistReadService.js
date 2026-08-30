const pickupSql = require('../../sql/pickupChecklistSqlService');
const returnSql = require('../../sql/returnChecklistSqlService');
const reservationSql = require('../../sql/reservationSqlService');
const { generatePdf } = require('../../pdf/pdfDocumentService');

async function downloadReservationPdf(reservationId, kind) {
  const reservation = await reservationSql.findById(reservationId);
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return generatePdf(kind, reservation);
}

async function getChecklists(reservationId) {
  const pickupChecklist = await pickupSql.findByReservationId(reservationId);
  const returnChecklist = await returnSql.findByReservationId(reservationId);
  return { pickupChecklist, returnChecklist };
}

module.exports = {
  downloadReservationPdf,
  getChecklists,
};
