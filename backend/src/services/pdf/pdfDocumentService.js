// Require the 'pdfkit' module as PDFDocument.
const PDFDocument = require('pdfkit');
// Destructure object properties into local variables.
const { formatDateForDisplay } = require('../../utils/dateFormatter');
// Destructure object properties into local variables.
const { LOCATION_LABELS } = require('../../constants/locations');
// Require the '../sql/pickupChecklistSqlService' module as pickupSql.
const pickupSql = require('../sql/pickupChecklistSqlService');
// Require the '../sql/returnChecklistSqlService' module as returnSql.
const returnSql = require('../sql/returnChecklistSqlService');
// Require the '../sql/orderSqlService' module as orderSql.
const orderSql = require('../sql/orderSqlService');

// Create the accent constant.
const ACCENT = '#C4A35A';
// Create the ink constant.
const INK = '#1a1a1a';
// Create the muted constant.
const MUTED = '#666666';

/**
 * location label.
 * @param {string|number} id
 * @returns {*}
 */
function locationLabel(id) {
  // Return the resulting value to the caller.
  return LOCATION_LABELS[id] || id || '—';
}

/**
 * money.
 * @param {*} value
 * @returns {*}
 */
function money(value) {
  // Return the resulting value to the caller.
  return `EUR ${Number(value || 0).toFixed(2)}`;
}

/**
 * car name.
 * @param {object} reservation
 * @returns {*}
 */
function carName(reservation) {
  // Evaluate the condition and enter the branch when it is true.
  if (reservation.carId && typeof reservation.carId === 'object') {
    // Return the resulting value to the caller.
    return reservation.carId.name || 'Vehicle';
  }
  // Return the resulting value to the caller.
  return 'Vehicle';
}

/**
 * draw header.
 * @param {*} doc
 * @param {*} title
 * @returns {*}
 */
function drawHeader(doc, title) {
  // Call doc.fillColor to perform this step.
  doc.fillColor(INK).fontSize(22).font('Helvetica-Bold').text('LuxRide', { continued: false });
  // Call doc.fillColor to perform this step.
  doc.fillColor(ACCENT).fontSize(10).font('Helvetica').text('Premium car rental — Bulgaria');
  // Call doc.moveDown to perform this step.
  doc.moveDown(0.5);
  // Call doc.fillColor to perform this step.
  doc.fillColor(INK).fontSize(16).font('Helvetica-Bold').text(title);
  // Call doc.moveDown to perform this step.
  doc.moveDown(0.75);
  // Call doc.strokeColor to perform this step.
  doc.strokeColor(ACCENT).lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  // Call doc.moveDown to perform this step.
  doc.moveDown(1);
}

/**
 * draw footer.
 * @param {*} doc
 * @returns {*}
 */
function drawFooter(doc) {
  // Create the bottom constant.
  const bottom = doc.page.height - 40;
  // Call doc.fontSize to perform this step.
  doc.fontSize(8).fillColor(MUTED).text(
    // Continue the surrounding logic with this statement.
    `Generated ${new Date().toISOString()} · LuxRide`,
    // Supply the literal value used by the enclosing expression.
    50,
    // Contribute this line to the enclosing declaration or statement.
    bottom,
    // Contribute this line to the enclosing declaration or statement.
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
  // Call doc.font to perform this step.
  doc.font('Helvetica-Bold').fillColor(INK).fontSize(10).text(`${label}: `, { continued: true });
  // Call doc.font to perform this step.
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
  // Call field to perform this step.
  field(doc, 'Reservation', `#${reservation.id}`);
  // Evaluate the condition and enter the branch when it is true.
  if (order?.id) field(doc, 'Order', `#${order.id}`);
  // Call field to perform this step.
  field(doc, 'Status', reservation.status);
  // Call field to perform this step.
  field(doc, 'Customer', reservation.fullName || reservation.email || '—');
  // Call field to perform this step.
  field(doc, 'Email', reservation.email || '—');
  // Call field to perform this step.
  field(doc, 'Phone', reservation.phoneNumber || '—');
  // Call field to perform this step.
  field(doc, 'Vehicle', carName(reservation));
  // Call field to perform this step.
  field(
    // Contribute this line to the enclosing declaration or statement.
    doc,
    // Supply the literal value used by the enclosing expression.
    'Pickup',
    // Continue the surrounding logic with this statement.
    `${formatDateForDisplay(reservation.pickupDate)} ${reservation.pickupTime || ''} — ${locationLabel(reservation.pickupLocation)}`
  );
  // Call field to perform this step.
  field(
    // Contribute this line to the enclosing declaration or statement.
    doc,
    // Supply the literal value used by the enclosing expression.
    'Return',
    // Continue the surrounding logic with this statement.
    `${formatDateForDisplay(reservation.returnDate)} ${reservation.returnTime || ''} — ${locationLabel(reservation.returnLocation)}`
  );
  // Call field to perform this step.
  field(doc, 'Rental days', reservation.rentalDays);
  // Call field to perform this step.
  field(doc, 'Total', money(reservation.totalPrice));
  // Call field to perform this step.
  field(doc, 'Deposit', money(reservation.deposit));
  // Call doc.moveDown to perform this step.
  doc.moveDown(0.5);
}

/**
 * Transform helper: build pdf buffer.
 * @param {*} buildFn
 * @returns {*}
 */
function buildPdfBuffer(buildFn) {
  // Return the resulting value to the caller.
  return new Promise((resolve, reject) => {
    // Create the doc constant.
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    // Create the chunks constant.
    const chunks = [];
    // Call doc.on to perform this step.
    doc.on('data', (chunk) => chunks.push(chunk));
    // Call doc.on to perform this step.
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    // Call doc.on to perform this step.
    doc.on('error', reject);
    // Protected block: isolate failure modes.
    try {
      // Call buildFn to perform this step.
      buildFn(doc);
      // Call drawFooter to perform this step.
      drawFooter(doc);
      // Call doc.end to perform this step.
      doc.end();
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call reject to perform this step.
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
  // Create the order constant.
  const order = await orderSql.findOrderByReservationId(reservation.id);
  // Create the pickup checklist constant.
  const pickupChecklist = await pickupSql.findByReservationId(reservation.id);
  // Create the return checklist constant.
  const returnChecklist = await returnSql.findByReservationId(reservation.id);
  // Return the resulting value to the caller.
  return { order, pickupChecklist, returnChecklist };
}

/**
 * generate rental agreement.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generateRentalAgreement(reservation) {
  // Destructure object properties into local variables.
  const { order } = await loadContext(reservation);
  // Return the resulting value to the caller.
  return buildPdfBuffer((doc) => {
    // Call drawHeader to perform this step.
    drawHeader(doc, 'Rental Agreement');
    // Call reservationBlock to perform this step.
    reservationBlock(doc, reservation, order);
    // Call doc.moveDown to perform this step.
    doc.moveDown(0.5);
    // Call doc.font to perform this step.
    doc.font('Helvetica').fillColor(INK).fontSize(10).text(
      // Supply the literal value used by the enclosing expression.
      'This agreement confirms the rental of the vehicle described above between LuxRide and the customer. ' +
        // Supply the literal value used by the enclosing expression.
        'The customer agrees to return the vehicle in the same condition subject to normal wear, ' +
        // Supply the literal value used by the enclosing expression.
        'comply with traffic laws, and pay any applicable fees for damage, fuel shortfall, or late return.'
    );
    // Call doc.moveDown to perform this step.
    doc.moveDown(1);
    // Call field to perform this step.
    field(doc, 'Flight number', reservation.flightNumber || '—');
    // Call field to perform this step.
    field(doc, 'Hotel', reservation.hotelName || '—');
    // Call field to perform this step.
    field(doc, 'Special requests', reservation.specialRequests || '—');
  });
}

/**
 * generate invoice.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generateInvoice(reservation) {
  // Destructure object properties into local variables.
  const { order } = await loadContext(reservation);
  // Return the resulting value to the caller.
  return buildPdfBuffer((doc) => {
    // Call drawHeader to perform this step.
    drawHeader(doc, 'Invoice');
    // Call reservationBlock to perform this step.
    reservationBlock(doc, reservation, order);
    // Call doc.moveDown to perform this step.
    doc.moveDown(0.5);
    // Call doc.font to perform this step.
    doc.font('Helvetica-Bold').fillColor(INK).fontSize(12).text('Charges');
    // Call doc.moveDown to perform this step.
    doc.moveDown(0.3);
    // Call field to perform this step.
    field(doc, 'Delivery', money(reservation.deliveryPrice));
    // Call field to perform this step.
    field(doc, 'Return fee', money(reservation.returnPrice));
    // Call field to perform this step.
    field(doc, 'Deposit held', money(reservation.deposit));
    // Call field to perform this step.
    field(doc, 'Amount due / paid', money(reservation.totalPrice));
    // Evaluate the condition and enter the branch when it is true.
    if (Array.isArray(reservation.selectedExtras) && reservation.selectedExtras.length) {
      // Call doc.moveDown to perform this step.
      doc.moveDown(0.3);
      // Call field to perform this step.
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
  // Destructure object properties into local variables.
  const { order } = await loadContext(reservation);
  // Return the resulting value to the caller.
  return buildPdfBuffer((doc) => {
    // Call drawHeader to perform this step.
    drawHeader(doc, 'Payment Receipt');
    // Call reservationBlock to perform this step.
    reservationBlock(doc, reservation, order);
    // Call field to perform this step.
    field(doc, 'Payment status', reservation.status);
    // Stripe / payment-related branch.
    if (reservation.stripeSessionId) {
      // Call field to perform this step.
      field(doc, 'Stripe session', reservation.stripeSessionId);
    }
    // Call doc.moveDown to perform this step.
    doc.moveDown(0.5);
    // Call doc.font to perform this step.
    doc.font('Helvetica').fillColor(INK).fontSize(10).text(
      // Supply the literal value used by the enclosing expression.
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
  // Destructure object properties into local variables.
  const { pickupChecklist, returnChecklist } = await loadContext(reservation);
  // Return the resulting value to the caller.
  return buildPdfBuffer((doc) => {
    // Call drawHeader to perform this step.
    drawHeader(doc, 'Damage Report');
    // Call reservationBlock to perform this step.
    reservationBlock(doc, reservation, null);
    // Call field to perform this step.
    field(doc, 'Existing damages (pickup)', pickupChecklist?.existingDamages || 'None recorded');
    // Call field to perform this step.
    field(doc, 'New damages (return)', returnChecklist?.newDamages || 'None recorded');
    // Evaluate the condition and enter the branch when it is true.
    if (returnChecklist) {
      // Call field to perform this step.
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
  // Destructure object properties into local variables.
  const { pickupChecklist } = await loadContext(reservation);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!pickupChecklist) {
    // Create the err constant.
    const err = new Error('Pickup checklist not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Return the resulting value to the caller.
  return buildPdfBuffer((doc) => {
    // Call drawHeader to perform this step.
    drawHeader(doc, 'Pickup Checklist');
    // Call reservationBlock to perform this step.
    reservationBlock(doc, reservation, null);
    // Call field to perform this step.
    field(doc, 'Fuel level', pickupChecklist.fuelLevel);
    // Call field to perform this step.
    field(doc, 'Mileage', pickupChecklist.mileage);
    // Call field to perform this step.
    field(doc, 'Pickup time', pickupChecklist.pickupTime);
    // Call field to perform this step.
    field(doc, 'Existing damages', pickupChecklist.existingDamages || 'None');
    // Call field to perform this step.
    field(doc, 'Notes', pickupChecklist.notes || '—');
    // Call field to perform this step.
    field(doc, 'Photos stored', (pickupChecklist.photos || []).length);
    // Call field to perform this step.
    field(doc, 'Customer signature', pickupChecklist.customerSignatureKey ? 'On file' : 'Missing');
    // Call field to perform this step.
    field(doc, 'Employee signature', pickupChecklist.employeeSignatureKey ? 'On file' : 'Missing');
  });
}

/**
 * generate return checklist pdf.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generateReturnChecklistPdf(reservation) {
  // Destructure object properties into local variables.
  const { returnChecklist } = await loadContext(reservation);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!returnChecklist) {
    // Create the err constant.
    const err = new Error('Return checklist not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Return the resulting value to the caller.
  return buildPdfBuffer((doc) => {
    // Call drawHeader to perform this step.
    drawHeader(doc, 'Return Checklist');
    // Call reservationBlock to perform this step.
    reservationBlock(doc, reservation, null);
    // Call field to perform this step.
    field(doc, 'Fuel level', returnChecklist.fuelLevel);
    // Call field to perform this step.
    field(doc, 'Mileage', returnChecklist.mileage);
    // Call field to perform this step.
    field(doc, 'Return time', returnChecklist.returnTime);
    // Call field to perform this step.
    field(doc, 'Late return', returnChecklist.lateReturn ? 'Yes' : 'No');
    // Call field to perform this step.
    field(doc, 'New damages', returnChecklist.newDamages || 'None');
    // Call field to perform this step.
    field(doc, 'Extra fees', money(returnChecklist.extraFees));
    // Call field to perform this step.
    field(doc, 'Notes', returnChecklist.notes || '—');
    // Call field to perform this step.
    field(doc, 'Photos stored', (returnChecklist.photos || []).length);
  });
}

// Create the generators constant.
const GENERATORS = {
  // Provide the rental agreement field value.
  rental_agreement: generateRentalAgreement,
  // Provide the invoice field value.
  invoice: generateInvoice,
  // Provide the receipt field value.
  receipt: generateReceipt,
  // Provide the damage report field value.
  damage_report: generateDamageReport,
  // Provide the pickup checklist field value.
  pickup_checklist: generatePickupChecklistPdf,
  // Provide the return checklist field value.
  return_checklist: generateReturnChecklistPdf,
};

/**
 * generate pdf.
 * @param {*} kind
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function generatePdf(kind, reservation) {
  // Create the generator constant.
  const generator = GENERATORS[kind];
  // Guard: early-return or throw when required input is missing/invalid.
  if (!generator) {
    // Create the err constant.
    const err = new Error('Unknown PDF document type');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Create the buffer constant.
  const buffer = await generator(reservation);
  // Create the filename constant.
  const filename = `luxride-${kind}-${reservation.id}.pdf`;
  // Return the resulting value to the caller.
  return { buffer, filename, contentType: 'application/pdf' };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  generatePdf,
  // Contribute this line to the enclosing declaration or statement.
  GENERATORS,
};
