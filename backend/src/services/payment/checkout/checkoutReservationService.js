/**
 * Resolve or create the pending reservation hold used during Stripe Checkout.
 * Enforces one active hold per browse session and refreshes hold expiry on retry.
 */
const { getSessionId, buildExistingReservationSummary } = require('../../../utils/reservationHelpers');
// Destructure object properties into local variables.
const { normalizeContactDetails } = require('../../paymentService');

// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  findActiveReservationBySession,
  // Contribute this line to the enclosing declaration or statement.
  extendReservationHold,
  // Contribute this line to the enclosing declaration or statement.
  attachCarNameToReservation,
  // Contribute this line to the enclosing declaration or statement.
  createPendingReservation,
  // Contribute this line to the enclosing declaration or statement.
  checkCarAvailabilityForRange,
// Continue the surrounding logic with this statement.
} = require('../../reservationService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../reservation/reservationStatusService');
// Destructure object properties into local variables.
const { buildRenderOrderPageResponse } = require('./checkoutResponseFactory');

/**
 * Guest-facing response when the car is already booked for the selected range.
 * @param {object} car
 * @param {object} formData
 * @param {object} pricing
 * @returns {{ ok: false, response: object }}
 */
function bookedUnavailableResponse(car, formData, pricing) {
  // Return the resulting value to the caller.
  return {
    // Provide the ok field value.
    ok: false,
    // Provide the response field value.
    response: buildRenderOrderPageResponse(
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      formData,
      // Supply the literal value used by the enclosing expression.
      'Selected car is already booked in this period. Please choose different dates or a different car.',
      {
        // Provide the rental days field value.
        rentalDays: pricing.rentalDays,
        // Provide the delivery price field value.
        deliveryPrice: pricing.deliveryPrice,
        // Provide the return price field value.
        returnPrice: pricing.returnPrice,
        // Provide the total price field value.
        totalPrice: pricing.totalPrice,
      }
    ),
  };
}

/**
 * Find/create the reservation for this checkout attempt.
 * Sets createdReservationThisStep so Stripe failure can cancel only new holds.
 *
 * @param {object} params
 * @returns {Promise<{ ok: true, reservationDoc: object, createdReservationThisStep: boolean } | { ok: false, response: object }>}
 */
async function resolveCheckoutReservation({ req, car, formData, startDate, endDate, pricing }) {
  // Create the trimmed contact constant.
  const trimmedContact = normalizeContactDetails(formData);
  // Create the session id constant.
  const sessionId = getSessionId(req);
  // Create the now constant.
  const now = new Date();

  // Initialize the mutable reservation doc variable.
  let reservationDoc = await findActiveReservationBySession(req);
  // Evaluate the condition and enter the branch when it is true.
  if (reservationDoc) {
    // Store the awaited result in reservationDoc.
    reservationDoc = await attachCarNameToReservation(reservationDoc);
  }

  // Initialize the mutable created reservation this step variable.
  let createdReservationThisStep = false;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservationDoc) {
    // Destructure object properties into local variables.
    const {
      // Provide the reservation field value.
      reservation: createdReservation,
      // Contribute this line to the enclosing declaration or statement.
      overlappingReservation,
      // Contribute this line to the enclosing declaration or statement.
      bookedOverlap,
      // Contribute this line to the enclosing declaration or statement.
      existingActiveReservation,
    // Continue the surrounding logic with this statement.
    } = await createPendingReservation(
      {
        // Provide the car id field value.
        carId: car.id,
        // Contribute this line to the enclosing declaration or statement.
        sessionId,
        // Contribute this line to the enclosing declaration or statement.
        startDate,
        // Contribute this line to the enclosing declaration or statement.
        endDate,
        // Provide the pickup time field value.
        pickupTime: formData.pickupTime,
        // Provide the return time field value.
        returnTime: formData.returnTime,
        // Provide the pickup location field value.
        pickupLocation: formData.pickupLocation,
        // Provide the return location field value.
        returnLocation: formData.returnLocation,
        // Contribute this line to the enclosing declaration or statement.
        pricing,
        // Provide the contact field value.
        contact: trimmedContact,
        // Contribute this line to the enclosing declaration or statement.
        now,
      },
      // Reference the identifier used by the enclosing expression.
      req
    );

    // Concurrent create may have lost to another request with the same session.
    if (existingActiveReservation) {
      // Store the awaited result in reservationDoc.
      reservationDoc = await attachCarNameToReservation(existingActiveReservation);
    // Continue the surrounding logic with this statement.
    } else if (overlappingReservation) {
      // Return the resulting value to the caller.
      return {
        // Provide the ok field value.
        ok: false,
        // Provide the response field value.
        response: buildRenderOrderPageResponse(
          // Contribute this line to the enclosing declaration or statement.
          car,
          // Contribute this line to the enclosing declaration or statement.
          formData,
          // Supply the literal value used by the enclosing expression.
          'Selected car is already reserved in this period. Please choose different dates or a different car.',
          {
            // Provide the rental days field value.
            rentalDays: pricing.rentalDays,
            // Provide the delivery price field value.
            deliveryPrice: pricing.deliveryPrice,
            // Provide the return price field value.
            returnPrice: pricing.returnPrice,
            // Provide the total price field value.
            totalPrice: pricing.totalPrice,
          }
        ),
      };
    // Continue the surrounding logic with this statement.
    } else if (bookedOverlap) {
      // Return the resulting value to the caller.
      return bookedUnavailableResponse(car, formData, pricing);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Update reservationDoc with the right-hand side value.
      reservationDoc = createdReservation;
      // Update createdReservationThisStep with the right-hand side value.
      createdReservationThisStep = true;
    }
  }

  // Existing hold: must match car/dates; otherwise require complete or release first.
  if (reservationDoc && !createdReservationThisStep) {
    // Create the same car constant.
    const sameCar =
      // Call String to perform this step.
      String(reservationDoc.carId?.id || reservationDoc.carId) === String(car.id);
    // Create the same start constant.
    const sameStart =
      // Contribute this line to the enclosing declaration or statement.
      reservationDoc.pickupDate instanceof Date &&
      // Call reservationDoc.pickupDate.getTime to perform this step.
      reservationDoc.pickupDate.getTime() === startDate.getTime();
    // Create the same end constant.
    const sameEnd =
      // Contribute this line to the enclosing declaration or statement.
      reservationDoc.returnDate instanceof Date &&
      // Call reservationDoc.returnDate.getTime to perform this step.
      reservationDoc.returnDate.getTime() === endDate.getTime();

    // Guard: early-return or throw when required input is missing/invalid.
    if (!sameCar || !sameStart || !sameEnd) {
      // Return the resulting value to the caller.
      return {
        // Provide the ok field value.
        ok: false,
        // Provide the response field value.
        response: buildRenderOrderPageResponse(
          // Contribute this line to the enclosing declaration or statement.
          car,
          // Contribute this line to the enclosing declaration or statement.
          formData,
          // Supply the literal value used by the enclosing expression.
          'You already have an active reservation. Please complete or release it before starting another.',
          {
            // Provide the existing reservation field value.
            existingReservation: buildExistingReservationSummary(reservationDoc),
            // Provide the rental days field value.
            rentalDays: pricing.rentalDays,
            // Provide the delivery price field value.
            deliveryPrice: pricing.deliveryPrice,
            // Provide the return price field value.
            returnPrice: pricing.returnPrice,
            // Provide the total price field value.
            totalPrice: pricing.totalPrice,
            // Provide the release redirect field value.
            releaseRedirect: req.originalUrl,
          }
        ),
      };
    }

    // Destructure object properties into local variables.
    const { bookedOverlap, openPhysicalRental } = await checkCarAvailabilityForRange({
      // Provide the car id field value.
      carId: car.id,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Contribute this line to the enclosing declaration or statement.
      now,
    });
    // Concurrency / overlap guard (race-sensitive).
    if (bookedOverlap || openPhysicalRental) {
      // Return the resulting value to the caller.
      return bookedUnavailableResponse(car, formData, pricing);
    }

    // Refresh hold TTL and sync contact/pricing before starting payment.
    extendReservationHold(reservationDoc);

    // Destructure object properties into local variables.
    const { reservation: updated } = await changeStatus({
      // Provide the reservation id field value.
      reservationId: reservationDoc.id,
      // Provide the new status field value.
      newStatus: 'pending_payment',
      // Provide the reason field value.
      reason: 'checkout_prepare',
      // Provide the actor field value.
      actor: { type: 'customer', req, userId: req?.session?.user?.id },
      // Provide the patch field value.
      patch: {
        // Provide the hold expires at field value.
        holdExpiresAt: reservationDoc.holdExpiresAt,
        // Provide the contact field value.
        contact: {
          // Provide the full name field value.
          fullName: trimmedContact.fullName,
          // Provide the phone number field value.
          phoneNumber: trimmedContact.phoneNumber,
          // Provide the email field value.
          email: trimmedContact.email,
          // Provide the address field value.
          address: trimmedContact.address,
          // Provide the hotel name field value.
          hotelName: trimmedContact.hotelName,
        },
        // Provide the pricing field value.
        pricing: {
          // Provide the rental days field value.
          rentalDays: pricing.rentalDays,
          // Provide the delivery price field value.
          deliveryPrice: pricing.deliveryPrice,
          // Provide the return price field value.
          returnPrice: pricing.returnPrice,
          // Provide the total price field value.
          totalPrice: pricing.totalPrice,
          // Provide the deposit field value.
          deposit: pricing.deposit,
          // Provide the snapshot field value.
          snapshot: pricing.snapshot,
          // Provide the selected extras field value.
          selectedExtras: pricing.snapshot?.selectedExtras,
          // Provide the hotel delivery field value.
          hotelDelivery: pricing.snapshot?.hotelDelivery,
        },
      },
    });

    // Store the awaited result in reservationDoc.
    reservationDoc = await attachCarNameToReservation(updated);
  }

  // Return the resulting value to the caller.
  return {
    // Provide the ok field value.
    ok: true,
    // Contribute this line to the enclosing declaration or statement.
    reservationDoc,
    // Contribute this line to the enclosing declaration or statement.
    createdReservationThisStep,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  resolveCheckoutReservation,
};
