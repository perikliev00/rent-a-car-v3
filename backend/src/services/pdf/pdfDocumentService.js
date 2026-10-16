const PDFDocument = require('pdfkit');
const { formatDateForDisplay } = require('../../utils/dateFormatter');
const { LOCATION_LABELS } = require('../../constants/locations');
const pickupSql = require('../sql/pickupChecklistSqlService');
const returnSql = require('../sql/returnChecklistSqlService');
const orderSql = require('../sql/orderSqlService');

const ACCENT = '#C4A35A';
const INK = '#1a1a1a';
const MUTED = '#666666';

/**
 * location label.
 * @param {string|number} id
 * @returns {*}
 */
function locationLabel(id) {
  return LOCATION_LABELS[id] || id || '—';
}

/**
 * money.
 * @param {*} value
 * @returns {*}
 */
function money(value) {
  return `EUR ${Number(value || 0).toFixed(2)}`;
}

/**
 * car name.
 * @param {object} reservation
 * @returns {*}
 */
function carName(reservation) {
  if (reservation.carId && typeof reservation.carId === 'object') {
    return reservation.carId.name || 'Vehicle';
  }
  return 'Vehicle';
}

/**
 * draw header.
 * @param {*} doc
 * @param {*} title
 * @returns {*}
 */
function drawHeader(doc, title) {
  doc.fillColor(INK).fontSize(22).font('Helvetica-Bold').text('LuxRide', { continued: false });
  doc.fillColor(ACCENT).fontSize(10).font('Helvetica').text('Premium car rental — Bulgaria');
  doc.moveDown(0.5);
  doc.fillColor(INK).fontSize(16).font('Helvetica-Bold').text(title);
  doc.moveDown(0.75);
  doc.strokeColor(ACCENT).lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);
}

/**
 * draw footer.
 * @param {*} doc
 * @returns {*}
 */
function drawFooter(doc) {
  const bottom = doc.page.height - 40;
  doc.fontSize(8).fillColor(MUTED).text(
    `Generated ${new Date().toISOString()} · LuxRide`,
    50,
    bottom,
    { align: 'center', width: 495 }
  );
}

/**
 * field.
 * @param {*} doc
 * @param {*} label
 * @param {*} value
 * @returns {*}
 */
function field(doc, label, value) {
  doc.font('Helvetica-Bold').fillColor(INK).fontSize(10).text(`${label}: `, { continued: true });
  doc.font('Helvetica').fillColor(MUTED).text(String(value ?? '—'));
}

/**
 * reservation block.
 * @param {*} doc
 * @param {object} reservation
 * @param {object} order
 * @returns {*}
 */
function reservationBlock(doc, reservation, order) {
  field(doc, 'Reservation', `#${reservation.id}`);
  if (order?.id) field(doc, 'Order', `#${order.id}`);
  field(doc, 'Status', reservation.status);
  field(doc, 'Customer', reservation.fullName || reservation.email || '—');
  field(doc, 'Email', reservation.email || '—');
  field(doc, 'Phone', reservation.phoneNumber || '—');
  field(doc, 'Vehicle', carName(reservation));
  field(
    doc,
    'Pickup',
    `${formatDateForDisplay(reservation.pickupDate)} ${reservation.pickupTime || ''} — ${locationLabel(reservation.pickupLocation)}`
  );
  field(
    doc,
    'Return',
    `${formatDateForDisplay(reservation.returnDate)} ${reservation.returnTime || ''} — ${locationLabel(reservation.returnLocation)}`
  );
  field(doc, 'Rental days', reservation.rentalDays);
  field(doc, 'Total', money(reservation.totalPrice));
  field(doc, 'Deposit', money(reservation.deposit));
  doc.moveDown(0.5);
}

/**
 * Transform helper: build pdf buffer.
 * @param {*} buildFn
 * @returns {*}
 */
function buildPdfBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    // Protected block: isolate failure modes.
    try {
      buildFn(doc);
      drawFooter(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Load context.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function loadContext(reservation) {
  const order = await orderSql.findOrderByReservationId(reservation.id);
  const pickupChecklist = await pickupSql.findByReservationId(reservation.id);
  const returnChecklist = await returnSql.findByReservationId(reservation.id);
  return { order, pickupChecklist, returnChecklist };
}

/**
 * generate rental agreement.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generateRentalAgreement(reservation) {
  const { order } = await loadContext(reservation);
  return buildPdfBuffer((doc) => {
    drawHeader(doc, 'Rental Agreement');
    reservationBlock(doc, reservation, order);
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor(INK).fontSize(10).text(
      'This agreement confirms the rental of the vehicle described above between LuxRide and the customer. ' +
        'The customer agrees to return the vehicle in the same condition subject to normal wear, ' +
        'comply with traffic laws, and pay any applicable fees for damage, fuel shortfall, or late return.'
    );
    doc.moveDown(1);
    field(doc, 'Flight number', reservation.flightNumber || '—');
    field(doc, 'Hotel', reservation.hotelName || '—');
    field(doc, 'Special requests', reservation.specialRequests || '—');
  });
}

/**
 * generate invoice.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generateInvoice(reservation) {
  const { order } = await loadContext(reservation);
  return buildPdfBuffer((doc) => {
    drawHeader(doc, 'Invoice');
    reservationBlock(doc, reservation, order);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fillColor(INK).fontSize(12).text('Charges');
    doc.moveDown(0.3);
    field(doc, 'Delivery', money(reservation.deliveryPrice));
    field(doc, 'Return fee', money(reservation.returnPrice));
    field(doc, 'Deposit held', money(reservation.deposit));
    field(doc, 'Amount due / paid', money(reservation.totalPrice));
    if (Array.isArray(reservation.selectedExtras) && reservation.selectedExtras.length) {
      doc.moveDown(0.3);
      field(doc, 'Extras', reservation.selectedExtras.join(', '));
    }
  });
}

/**
 * generate receipt.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generateReceipt(reservation) {
  const { order } = await loadContext(reservation);
  return buildPdfBuffer((doc) => {
    drawHeader(doc, 'Payment Receipt');
    reservationBlock(doc, reservation, order);
    field(doc, 'Payment status', reservation.status);
    // Stripe / payment-related branch.
    if (reservation.stripeSessionId) {
      field(doc, 'Stripe session', reservation.stripeSessionId);
    }
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor(INK).fontSize(10).text(
      'Thank you for your payment. Keep this receipt for your records.'
    );
  });
}

/**
 * generate damage report.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generateDamageReport(reservation) {
  const { pickupChecklist, returnChecklist } = await loadContext(reservation);
  return buildPdfBuffer((doc) => {
    drawHeader(doc, 'Damage Report');
    reservationBlock(doc, reservation, null);
    field(doc, 'Existing damages (pickup)', pickupChecklist?.existingDamages || 'None recorded');
    field(doc, 'New damages (return)', returnChecklist?.newDamages || 'None recorded');
    if (returnChecklist) {
      field(doc, 'Extra fees', money(returnChecklist.extraFees));
    }
  });
}

/**
 * generate pickup checklist pdf.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generatePickupChecklistPdf(reservation) {
  const { pickupChecklist } = await loadContext(reservation);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!pickupChecklist) {
    const err = new Error('Pickup checklist not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return buildPdfBuffer((doc) => {
    drawHeader(doc, 'Pickup Checklist');
    reservationBlock(doc, reservation, null);
    field(doc, 'Fuel level', pickupChecklist.fuelLevel);
    field(doc, 'Mileage', pickupChecklist.mileage);
    field(doc, 'Pickup time', pickupChecklist.pickupTime);
    field(doc, 'Existing damages', pickupChecklist.existingDamages || 'None');
    field(doc, 'Notes', pickupChecklist.notes || '—');
    field(doc, 'Photos stored', (pickupChecklist.photos || []).length);
    field(doc, 'Customer signature', pickupChecklist.customerSignatureKey ? 'On file' : 'Missing');
    field(doc, 'Employee signature', pickupChecklist.employeeSignatureKey ? 'On file' : 'Missing');
  });
}

/**
 * generate return checklist pdf.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generateReturnChecklistPdf(reservation) {
  const { returnChecklist } = await loadContext(reservation);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!returnChecklist) {
    const err = new Error('Return checklist not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return buildPdfBuffer((doc) => {
    drawHeader(doc, 'Return Checklist');
    reservationBlock(doc, reservation, null);
    field(doc, 'Fuel level', returnChecklist.fuelLevel);
    field(doc, 'Mileage', returnChecklist.mileage);
    field(doc, 'Return time', returnChecklist.returnTime);
    field(doc, 'Late return', returnChecklist.lateReturn ? 'Yes' : 'No');
    field(doc, 'New damages', returnChecklist.newDamages || 'None');
    field(doc, 'Extra fees', money(returnChecklist.extraFees));
    field(doc, 'Notes', returnChecklist.notes || '—');
    field(doc, 'Photos stored', (returnChecklist.photos || []).length);
  });
}

const GENERATORS = {
  rental_agreement: generateRentalAgreement,
  invoice: generateInvoice,
  receipt: generateReceipt,
  damage_report: generateDamageReport,
  pickup_checklist: generatePickupChecklistPdf,
  return_checklist: generateReturnChecklistPdf,
};

/**
 * generate pdf.
 * @param {*} kind
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generatePdf(kind, reservation) {
  const generator = GENERATORS[kind];
  // Guard: early-return or throw when required input is missing/invalid.
  if (!generator) {
    const err = new Error('Unknown PDF document type');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }
  const buffer = await generator(reservation);
  const filename = `luxride-${kind}-${reservation.id}.pdf`;
  return { buffer, filename, contentType: 'application/pdf' };
}

module.exports = {
  generatePdf,
  GENERATORS,
};
