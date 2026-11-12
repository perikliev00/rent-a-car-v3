// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/admin-reservations'.
import { applyOpsStatus, changeOpsStatusViaApi, refundReservationViaApi } from '../helpers/admin-reservations';
// Import named exports from '../helpers/booking'.
import { buildSearchQuery, continueToCheckoutAndFillGuest, openOrderAndResolveConflict } from '../helpers/booking';
// Import named exports from '../helpers/csrf'.
import { loginAsAdmin } from '../helpers/csrf';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  assertReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  assertStatusHistoryContains,
  // Contribute this line to the enclosing declaration or statement.
  assertStatusHistorySequence,
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  countDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  countNotificationsByType,
  // Contribute this line to the enclosing declaration or statement.
  countOrdersForCar,
  // Contribute this line to the enclosing declaration or statement.
  deleteDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  eurosToStripeCents,
  // Contribute this line to the enclosing declaration or statement.
  getCarStatus,
  // Contribute this line to the enclosing declaration or statement.
  getOrderByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  getRefundOperationByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  getReservationByStripeSessionId,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/fleet'.
import { searchPublicCars } from '../helpers/fleet';
// Import named exports from '../helpers/notifications'.
import { listNotificationsViaApi } from '../helpers/notifications';
// Import named exports from '../helpers/rbac'.
import { cleanupTestStaff, insertTestStaff, loginAsStaff } from '../helpers/rbac';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/stripe-webhook'.
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
// Import named exports from '../helpers/test-env'.
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("admin-reservation-lifecycle", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Admin Lifecycle ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-004 Valid lifecycle → history + fleet', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 3, nights: 3 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('lifecycle');

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('ops Apply walks confirmed→completed and updates history + fleet', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Lifecycle Guest' },
      });
      // Create the reservation id constant.
      const reservationId = seeded.reservationId;

      // Future confirmed rows are not in Today's widgets — use API-backed Apply helper.
      for (const status of ['car_prepared', 'picked_up', 'active_rental', 'returned'] as const) {
        // Wait until the asynchronous operation resolves.
        await applyOpsStatus(adminPage, reservationId, status, { request });
        // Wait until the asynchronous operation resolves.
        await assertReservationStatus(reservationId, status);
        // Wait until the asynchronous operation resolves.
        await assertStatusHistoryContains(reservationId, status);

        // Evaluate the condition and enter the branch when it is true.
        if (status === 'picked_up' || status === 'active_rental') {
          // Assert that the value matches the intended expectation.
          expect(await getCarStatus(carId)).toBe('rented');
        }
        // Evaluate the condition and enter the branch when it is true.
        if (status === 'returned') {
          // Assert that the value matches the intended expectation.
          expect(await getCarStatus(carId)).toBe('needs_cleaning');
        }
      }

      // Create the completed constant.
      const completed = await changeOpsStatusViaApi(request, reservationId, 'completed');
      // Assert that the value matches the intended expectation.
      expect(completed.ok).toBeTruthy();
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(reservationId, 'completed');

      // Wait until the asynchronous operation resolves.
      await assertStatusHistorySequence(reservationId, [
        // Supply the literal value used by the enclosing expression.
        'confirmed',
        // Supply the literal value used by the enclosing expression.
        'car_prepared',
        // Supply the literal value used by the enclosing expression.
        'picked_up',
        // Supply the literal value used by the enclosing expression.
        'active_rental',
        // Supply the literal value used by the enclosing expression.
        'returned',
        // Supply the literal value used by the enclosing expression.
        'completed',
      ]);

      // Wait until the asynchronous operation resolves.
      await adminPage.goto(`/admin/reservations?id=${reservationId}`);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Status History' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('completed').first()).toBeVisible();
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-no-show-availability", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E NoShow Avail ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-021 No-show frees remaining availability', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Future range avoids "pickup must be later than now" search validation.
    const range = allocateFutureRange({ fromDaysAhead: 2, nights: 4 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('no-show');

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('no_show clears date blocks and frees the car for search', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      page,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: guestEmail, fullName: 'No Show Guest' },
      });
      // Create the reservation id constant.
      const reservationId = seeded.reservationId;

      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(1);

      // Future confirmed bookings are not in Today's widgets — Apply falls back to admin API.
      await applyOpsStatus(adminPage, reservationId, 'no_show', { request });
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(reservationId, 'no_show');
      // Wait until the asynchronous operation resolves.
      await assertStatusHistoryContains(reservationId, 'no_show');

      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(0);

      // Create the car status constant.
      const carStatus = await getCarStatus(carId);
      // Assert that the value matches the intended expectation.
      expect(carStatus).not.toBe('reserved');

      // Wait until the asynchronous operation resolves.
      await page.goto(`/search?${buildSearchQuery(range)}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-manual-review-resolve", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Manual Review Resolve ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Manual review confirm + refund resolve (83)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(150_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range confirm constant.
    const rangeConfirm = allocateFutureRange({ fromDaysAhead: 170, nights: 2 });
    // Create the range refund constant.
    const rangeRefund = allocateFutureRange({ fromDaysAhead: 175, nights: 2 });
    // Initialize the mutable receptionist email variable.
    let receptionistEmail = '';

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (receptionistEmail) {
        // Wait until the asynchronous operation resolves.
        await cleanupTestStaff(receptionistEmail).catch(() => undefined);
      }
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId).catch(() => undefined);
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('confirm from manual_review creates order + block; refund frees and clears widget', async ({
      // Contribute this line to the enclosing declaration or statement.
      request,
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);

      // Create the confirm email constant.
      const confirmEmail = uniqueEmail('mr-confirm');
      // Create the confirm seed constant.
      const confirmSeed = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'manual_review',
        // Provide the pickup date field value.
        pickupDate: rangeConfirm.pickupDate,
        // Provide the return date field value.
        returnDate: rangeConfirm.returnDate,
        // Provide the pickup time field value.
        pickupTime: rangeConfirm.pickupTime,
        // Provide the return time field value.
        returnTime: rangeConfirm.returnTime,
        // Provide the with order field value.
        withOrder: false,
        // Provide the with block field value.
        withBlock: false,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: confirmEmail, fullName: 'MR Confirm' },
      });

      // Conflict block mimicking paid-overlap case — clear before confirm (product path).
      await deleteDateBlocksForCar(carId);

      // Create the owner constant.
      const owner = await loginAsAdmin(request);
      // Create the confirm res constant.
      const confirmRes = await changeOpsStatusViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        confirmSeed.reservationId,
        // Supply the literal value used by the enclosing expression.
        'confirmed',
        // Reference the identifier used by the enclosing expression.
        owner
      );
      // Assert that the value matches the intended expectation.
      expect(confirmRes.ok, JSON.stringify(confirmRes.body)).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(confirmSeed.reservationId, 'confirmed');
      // Assert that the value matches the intended expectation.
      expect(await getOrderByReservationId(confirmSeed.reservationId)).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(await countOrdersForCar(carId)).toBe(1);
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(1);

      // Create the refund email constant.
      const refundEmail = uniqueEmail('mr-refund');
      // Create the refund seed constant.
      const refundSeed = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'manual_review',
        // Provide the pickup date field value.
        pickupDate: rangeRefund.pickupDate,
        // Provide the return date field value.
        returnDate: rangeRefund.returnDate,
        // Provide the pickup time field value.
        pickupTime: rangeRefund.pickupTime,
        // Provide the return time field value.
        returnTime: rangeRefund.returnTime,
        // Provide the with order field value.
        withOrder: false,
        // Provide the with block field value.
        withBlock: true,
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: `pi_e2e_mr_refund_${Date.now()}`,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: refundEmail, fullName: 'MR Refund' },
      });
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(2);

      // Create the blocks before deny constant.
      const blocksBeforeDeny = await countDateBlocksForCar(carId);
      // Create the receptionist constant.
      const receptionist = await insertTestStaff({ roleSlug: 'receptionist' });
      // Update receptionistEmail with the right-hand side value.
      receptionistEmail = receptionist.email;
      // Create the reception session constant.
      const receptionSession = await loginAsStaff(request, receptionist);
      // Create the denied constant.
      const denied = await refundReservationViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        refundSeed.reservationId,
        // Reference the identifier used by the enclosing expression.
        receptionSession
      );
      // Assert that the value matches the intended expectation.
      expect(denied.status).toBe(403);
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(refundSeed.reservationId, 'manual_review');
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(blocksBeforeDeny);

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/reservations');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Refresh' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByRole to perform this step.
        adminPage.getByRole('button', { name: String(refundSeed.reservationId), exact: true }).first()
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 15_000 });

      // loginAsStaff above replaced the shared Playwright request cookie jar.
      // Re-login so CSRF token matches the session cookie.
      const ownerAgain = await loginAsAdmin(request);
      // Create the refund res constant.
      const refundRes = await refundReservationViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        refundSeed.reservationId,
        // Contribute this line to the enclosing declaration or statement.
        ownerAgain,
        // Supply the literal value used by the enclosing expression.
        'admin_manual_review_refund'
      );
      // Assert that the value matches the intended expectation.
      expect(refundRes.ok, JSON.stringify(refundRes.body)).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(refundSeed.reservationId, 'refunded');
      // Assert that the value matches the intended expectation.
      expect(await getOrderByReservationId(refundSeed.reservationId)).toBeNull();
      // Assert that the value matches the intended expectation.
      expect((await getRefundOperationByReservationId(refundSeed.reservationId))?.status).toBe(
        // Supply the literal value used by the enclosing expression.
        'succeeded'
      );
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(1);

      // Create the search constant.
      const search = await searchPublicCars(request, {
        // Provide the pickup date field value.
        pickupDate: rangeRefund.pickupDate,
        // Provide the return date field value.
        returnDate: rangeRefund.returnDate,
        // Provide the pickup time field value.
        pickupTime: rangeRefund.pickupTime,
        // Provide the return time field value.
        returnTime: rangeRefund.returnTime,
      });
      // Assert that the value matches the intended expectation.
      expect(search.status).toBe(200);
      // Assert that the value matches the intended expectation.
      expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(true);

      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Refresh' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByRole to perform this step.
        adminPage.getByRole('button', { name: String(refundSeed.reservationId), exact: true })
      // Continue the surrounding logic with this statement.
      ).toHaveCount(0);
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-notifications-booking", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Notif Booking ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Admin notifications after booking (91)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 260, nights: 2 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('notif-book');

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId).catch(() => undefined);
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('confirmation and admin_new_booking_alert appear as sent', async ({
      // Contribute this line to the enclosing declaration or statement.
      page,
      // Contribute this line to the enclosing declaration or statement.
      request,
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);

      // Wait until the asynchronous operation resolves.
      await openOrderAndResolveConflict(page, carId, range);
      // Wait until the asynchronous operation resolves.
      await continueToCheckoutAndFillGuest(page, carId, {
        // Spread E2E_GUEST into the surrounding structure.
        ...E2E_GUEST,
        // Provide the email field value.
        email: guestEmail,
        // Provide the hotel name field value.
        hotelName: '',
      });
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Pay with Stripe' }).click();
      // Wait until the asynchronous operation resolves.
      await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

      // Create the stripe session id constant.
      const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
      // Create the reservation constant.
      const reservation = await getReservationByStripeSessionId(stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(reservation).toBeTruthy();

      // Create the event constant.
      const event = buildCheckoutCompletedEvent({
        // Provide the event id field value.
        eventId: `evt_e2e_notif_${Date.now()}`,
        // Provide the session id field value.
        sessionId: stripeSessionId,
        // Provide the reservation id field value.
        reservationId: reservation.id,
        // Provide the car id field value.
        carId: reservation.car_id,
        // Provide the session id meta field value.
        sessionIdMeta: reservation.session_id,
        // Provide the amount total field value.
        amountTotal: eurosToStripeCents(Number(reservation.total_price)),
      });
      // Assert that the value matches the intended expectation.
      expect((await postSignedWebhook(request, event)).status()).toBe(200);

      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(
          // Call async to perform this step.
          async () =>
            // Continue the surrounding logic with this statement.
            (await countNotificationsByType('reservation_confirmation', {
              // Provide the reservation id field value.
              reservationId: Number(reservation.id),
            // Continue the surrounding logic with this statement.
            })) >= 1,
          // Contribute this line to the enclosing declaration or statement.
          { timeout: 15_000 }
        )
        // Call .toBe to perform this step.
        .toBe(true);
      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(
          // Call async to perform this step.
          async () =>
            // Continue the surrounding logic with this statement.
            (await countNotificationsByType('admin_new_booking_alert', {
              // Provide the reservation id field value.
              reservationId: Number(reservation.id),
            // Continue the surrounding logic with this statement.
            })) >= 1,
          // Contribute this line to the enclosing declaration or statement.
          { timeout: 15_000 }
        )
        // Call .toBe to perform this step.
        .toBe(true);

      // Create the listed constant.
      const listed = await listNotificationsViaApi(request, { limit: 50, status: 'sent' });
      // Assert that the value matches the intended expectation.
      expect(listed.ok, JSON.stringify(listed.body)).toBeTruthy();
      // Create the types constant.
      const types = listed.items.map((n: { type?: string }) => n.type);
      // Assert that the value matches the intended expectation.
      expect(types).toContain('reservation_confirmation');
      // Assert that the value matches the intended expectation.
      expect(types).toContain('admin_new_booking_alert');

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/notifications');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Notifications' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await adminPage.getByLabel('Status').selectOption('sent');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('reservation_confirmation').first()).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('admin_new_booking_alert').first()).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(guestEmail).first()).toBeVisible();
    });
  });
});
