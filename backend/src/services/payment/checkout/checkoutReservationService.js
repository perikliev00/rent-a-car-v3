/**
 * Resolve or create the pending reservation hold used during Stripe Checkout.
 * Enforces one active hold per browse session and refreshes hold expiry on retry.
 */
const { getSessionId, buildExistingReservationSummary } = require('../../../utils/reservationHelpers');
const { normalizeContactDetails } = require('../../paymentService');

const {
  findActiveReservationBySession,
  extendReservationHold,
  attachCarNameToReservation,
  createPendingReservation,
  checkCarAvailabilityForRange,
} = require('../../reservationService');
const { changeStatus } = require('../../reservation/reservationStatusService');
const { buildRenderOrderPageResponse } = require('./checkoutResponseFactory');

/**
 * Guest-facing response when the car is already booked for the selected range.
 * @param {object} car
 * @param {object} formData
 * @param {object} pricing
 * @returns {{ ok: false, response: object }}
 */
function bookedUnavailableResponse(car, formData, pricing) {
  return {
    ok: false,
    response: buildRenderOrderPageResponse(
      car,
      formData,
      'Selected car is already booked in this period. Please choose different dates or a different car.',
      {
        rentalDays: pricing.rentalDays,
        deliveryPrice: pricing.deliveryPrice,
        returnPrice: pricing.returnPrice,
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
  const trimmedContact = normalizeContactDetails(formData);
  const sessionId = getSessionId(req);
  const now = new Date();

  let reservationDoc = await findActiveReservationBySession(req);
  if (reservationDoc) {
    reservationDoc = await attachCarNameToReservation(reservationDoc);
  }

  let createdReservationThisStep = false;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservationDoc) {
    const {
      reservation: createdReservation,
      overlappingReservation,
      bookedOverlap,
      existingActiveReservation,
    } = await createPendingReservation(
      {
        carId: car.id,
        sessionId,
        startDate,
        endDate,
        pickupTime: formData.pickupTime,
        returnTime: formData.returnTime,
        pickupLocation: formData.pickupLocation,
        returnLocation: formData.returnLocation,
        pricing,
        contact: trimmedContact,
        now,
      },
      req
    );

    // Concurrent create may have lost to another request with the same session.
    if (existingActiveReservation) {
      reservationDoc = await attachCarNameToReservation(existingActiveReservation);
    } else if (overlappingReservation) {
      return {
        ok: false,
        response: buildRenderOrderPageResponse(
          car,
          formData,
          'Selected car is already reserved in this period. Please choose different dates or a different car.',
          {
            rentalDays: pricing.rentalDays,
            deliveryPrice: pricing.deliveryPrice,
            returnPrice: pricing.returnPrice,
            totalPrice: pricing.totalPrice,
          }
        ),
      };
    } else if (bookedOverlap) {
      return bookedUnavailableResponse(car, formData, pricing);
    } else {
      reservationDoc = createdReservation;
      createdReservationThisStep = true;
    }
  }

  // Existing hold: must match car/dates; otherwise require complete or release first.
  if (reservationDoc && !createdReservationThisStep) {
    const sameCar =
      String(reservationDoc.carId?.id || reservationDoc.carId) === String(car.id);
    const sameStart =
      reservationDoc.pickupDate instanceof Date &&
      reservationDoc.pickupDate.getTime() === startDate.getTime();
    const sameEnd =
      reservationDoc.returnDate instanceof Date &&
      reservationDoc.returnDate.getTime() === endDate.getTime();

    // Guard: early-return or throw when required input is missing/invalid.
    if (!sameCar || !sameStart || !sameEnd) {
      return {
        ok: false,
        response: buildRenderOrderPageResponse(
          car,
          formData,
          'You already have an active reservation. Please complete or release it before starting another.',
          {
            existingReservation: buildExistingReservationSummary(reservationDoc),
            rentalDays: pricing.rentalDays,
            deliveryPrice: pricing.deliveryPrice,
            returnPrice: pricing.returnPrice,
            totalPrice: pricing.totalPrice,
            releaseRedirect: req.originalUrl,
          }
        ),
      };
    }

    const { bookedOverlap, openPhysicalRental } = await checkCarAvailabilityForRange({
      carId: car.id,
      startDate,
      endDate,
      now,
    });
    // Concurrency / overlap guard (race-sensitive).
    if (bookedOverlap || openPhysicalRental) {
      return bookedUnavailableResponse(car, formData, pricing);
    }

    // Refresh hold TTL and sync contact/pricing before starting payment.
    extendReservationHold(reservationDoc);

    const { reservation: updated } = await changeStatus({
      reservationId: reservationDoc.id,
      newStatus: 'pending_payment',
      reason: 'checkout_prepare',
      actor: { type: 'customer', req, userId: req?.session?.user?.id },
      patch: {
        holdExpiresAt: reservationDoc.holdExpiresAt,
        contact: {
          fullName: trimmedContact.fullName,
          phoneNumber: trimmedContact.phoneNumber,
          email: trimmedContact.email,
          address: trimmedContact.address,
          hotelName: trimmedContact.hotelName,
        },
        pricing: {
          rentalDays: pricing.rentalDays,
          deliveryPrice: pricing.deliveryPrice,
          returnPrice: pricing.returnPrice,
          totalPrice: pricing.totalPrice,
          deposit: pricing.deposit,
          snapshot: pricing.snapshot,
          selectedExtras: pricing.snapshot?.selectedExtras,
          hotelDelivery: pricing.snapshot?.hotelDelivery,
        },
      },
    });

    reservationDoc = await attachCarNameToReservation(updated);
  }

  return {
    ok: true,
    reservationDoc,
    createdReservationThisStep,
  };
}

module.exports = {
  resolveCheckoutReservation,
};
