import { expect, test } from '../fixtures/base';
import { applyOpsStatus, changeOpsStatusViaApi, refundReservationViaApi } from '../helpers/admin-reservations';
import { buildSearchQuery, continueToCheckoutAndFillGuest, openOrderAndResolveConflict } from '../helpers/booking';
import { loginAsAdmin } from '../helpers/csrf';
import {
  assertReservationStatus,
  assertStatusHistoryContains,
  assertStatusHistorySequence,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  countDateBlocksForCar,
  countNotificationsByType,
  countOrdersForCar,
  deleteDateBlocksForCar,
  eurosToStripeCents,
  getCarStatus,
  getOrderByReservationId,
  getRefundOperationByReservationId,
  getReservationByStripeSessionId,
} from '../helpers/db';
import { searchPublicCars } from '../helpers/fleet';
import { listNotificationsViaApi } from '../helpers/notifications';
import { cleanupTestStaff, insertTestStaff, loginAsStaff } from '../helpers/rbac';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("admin-reservation-lifecycle", () => {
  const CAR_NAME = `E2E Admin Lifecycle ${Date.now()}`;

  test.describe('ADMIN-004 Valid lifecycle → history + fleet', () => {
    test.setTimeout(180_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 3, nights: 3 });
    const guestEmail = uniqueEmail('lifecycle');

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupTestCar(carId);
    });

    test.beforeEach(async () => {
      await cleanupReservationsForCar(carId);
    });

    test('ops Apply walks confirmed→completed and updates history + fleet', async ({
      adminPage,
      request,
    }) => {
      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Lifecycle Guest' },
      });
      const reservationId = seeded.reservationId;

      // Future confirmed rows are not in Today's widgets — use API-backed Apply helper.
      for (const status of ['car_prepared', 'picked_up', 'active_rental', 'returned'] as const) {
        await applyOpsStatus(adminPage, reservationId, status, { request });
        await assertReservationStatus(reservationId, status);
        await assertStatusHistoryContains(reservationId, status);

        if (status === 'picked_up' || status === 'active_rental') {
          expect(await getCarStatus(carId)).toBe('rented');
        }
        if (status === 'returned') {
          expect(await getCarStatus(carId)).toBe('needs_cleaning');
        }
      }

      const completed = await changeOpsStatusViaApi(request, reservationId, 'completed');
      expect(completed.ok).toBeTruthy();
      await assertReservationStatus(reservationId, 'completed');

      await assertStatusHistorySequence(reservationId, [
        'confirmed',
        'car_prepared',
        'picked_up',
        'active_rental',
        'returned',
        'completed',
      ]);

      await adminPage.goto(`/admin/reservations?id=${reservationId}`);
      await expect(adminPage.getByRole('heading', { name: 'Status History' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(adminPage.getByText('completed').first()).toBeVisible();
    });
  });
});

test.describe("admin-no-show-availability", () => {
  const CAR_NAME = `E2E NoShow Avail ${Date.now()}`;

  test.describe('ADMIN-021 No-show frees remaining availability', () => {
    test.setTimeout(120_000);

    let carId: number;
    // Future range avoids "pickup must be later than now" search validation.
    const range = allocateFutureRange({ fromDaysAhead: 2, nights: 4 });
    const guestEmail = uniqueEmail('no-show');

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupTestCar(carId);
    });

    test.beforeEach(async () => {
      await cleanupReservationsForCar(carId);
    });

    test('no_show clears date blocks and frees the car for search', async ({
      adminPage,
      page,
      request,
    }) => {
      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        guest: { ...E2E_GUEST, email: guestEmail, fullName: 'No Show Guest' },
      });
      const reservationId = seeded.reservationId;

      expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(1);

      // Future confirmed bookings are not in Today's widgets — Apply falls back to admin API.
      await applyOpsStatus(adminPage, reservationId, 'no_show', { request });
      await assertReservationStatus(reservationId, 'no_show');
      await assertStatusHistoryContains(reservationId, 'no_show');

      expect(await countDateBlocksForCar(carId)).toBe(0);

      const carStatus = await getCarStatus(carId);
      expect(carStatus).not.toBe('reserved');

      await page.goto(`/search?${buildSearchQuery(range)}`);
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
    });
  });
});

test.describe("admin-manual-review-resolve", () => {
  const CAR_NAME = `E2E Manual Review Resolve ${Date.now()}`;

  test.describe('Manual review confirm + refund resolve (83)', () => {
    test.setTimeout(150_000);

    let carId: number;
    const rangeConfirm = allocateFutureRange({ fromDaysAhead: 170, nights: 2 });
    const rangeRefund = allocateFutureRange({ fromDaysAhead: 175, nights: 2 });
    let receptionistEmail = '';

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      if (receptionistEmail) {
        await cleanupTestStaff(receptionistEmail).catch(() => undefined);
      }
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test('confirm from manual_review creates order + block; refund frees and clears widget', async ({
      request,
      adminPage,
    }) => {
      await cleanupReservationsForCar(carId);

      const confirmEmail = uniqueEmail('mr-confirm');
      const confirmSeed = await seedLinkedBooking({
        carId,
        status: 'manual_review',
        pickupDate: rangeConfirm.pickupDate,
        returnDate: rangeConfirm.returnDate,
        pickupTime: rangeConfirm.pickupTime,
        returnTime: rangeConfirm.returnTime,
        withOrder: false,
        withBlock: false,
        guest: { ...E2E_GUEST, email: confirmEmail, fullName: 'MR Confirm' },
      });

      // Conflict block mimicking paid-overlap case — clear before confirm (product path).
      await deleteDateBlocksForCar(carId);

      const owner = await loginAsAdmin(request);
      const confirmRes = await changeOpsStatusViaApi(
        request,
        confirmSeed.reservationId,
        'confirmed',
        owner
      );
      expect(confirmRes.ok, JSON.stringify(confirmRes.body)).toBeTruthy();

      await assertReservationStatus(confirmSeed.reservationId, 'confirmed');
      expect(await getOrderByReservationId(confirmSeed.reservationId)).toBeTruthy();
      expect(await countOrdersForCar(carId)).toBe(1);
      expect(await countDateBlocksForCar(carId)).toBe(1);

      const refundEmail = uniqueEmail('mr-refund');
      const refundSeed = await seedLinkedBooking({
        carId,
        status: 'manual_review',
        pickupDate: rangeRefund.pickupDate,
        returnDate: rangeRefund.returnDate,
        pickupTime: rangeRefund.pickupTime,
        returnTime: rangeRefund.returnTime,
        withOrder: false,
        withBlock: true,
        stripePaymentIntentId: `pi_e2e_mr_refund_${Date.now()}`,
        guest: { ...E2E_GUEST, email: refundEmail, fullName: 'MR Refund' },
      });
      expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(2);

      const blocksBeforeDeny = await countDateBlocksForCar(carId);
      const receptionist = await insertTestStaff({ roleSlug: 'receptionist' });
      receptionistEmail = receptionist.email;
      const receptionSession = await loginAsStaff(request, receptionist);
      const denied = await refundReservationViaApi(
        request,
        refundSeed.reservationId,
        receptionSession
      );
      expect(denied.status).toBe(403);
      await assertReservationStatus(refundSeed.reservationId, 'manual_review');
      expect(await countDateBlocksForCar(carId)).toBe(blocksBeforeDeny);

      await adminPage.goto('/admin/reservations');
      await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
        timeout: 15_000,
      });
      await adminPage.getByRole('button', { name: 'Refresh' }).click();
      await expect(
        adminPage.getByRole('button', { name: String(refundSeed.reservationId), exact: true }).first()
      ).toBeVisible({ timeout: 15_000 });

      // loginAsStaff above replaced the shared Playwright request cookie jar.
      // Re-login so CSRF token matches the session cookie.
      const ownerAgain = await loginAsAdmin(request);
      const refundRes = await refundReservationViaApi(
        request,
        refundSeed.reservationId,
        ownerAgain,
        'admin_manual_review_refund'
      );
      expect(refundRes.ok, JSON.stringify(refundRes.body)).toBeTruthy();

      await assertReservationStatus(refundSeed.reservationId, 'refunded');
      expect(await getOrderByReservationId(refundSeed.reservationId)).toBeNull();
      expect((await getRefundOperationByReservationId(refundSeed.reservationId))?.status).toBe(
        'succeeded'
      );
      expect(await countDateBlocksForCar(carId)).toBe(1);

      const search = await searchPublicCars(request, {
        pickupDate: rangeRefund.pickupDate,
        returnDate: rangeRefund.returnDate,
        pickupTime: rangeRefund.pickupTime,
        returnTime: rangeRefund.returnTime,
      });
      expect(search.status).toBe(200);
      expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(true);

      await adminPage.getByRole('button', { name: 'Refresh' }).click();
      await expect(
        adminPage.getByRole('button', { name: String(refundSeed.reservationId), exact: true })
      ).toHaveCount(0);
    });
  });
});

test.describe("admin-notifications-booking", () => {
  const CAR_NAME = `E2E Notif Booking ${Date.now()}`;

  test.describe('Admin notifications after booking (91)', () => {
    test.setTimeout(180_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 260, nights: 2 });
    const guestEmail = uniqueEmail('notif-book');

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test('confirmation and admin_new_booking_alert appear as sent', async ({
      page,
      request,
      adminPage,
    }) => {
      await cleanupReservationsForCar(carId);

      await openOrderAndResolveConflict(page, carId, range);
      await continueToCheckoutAndFillGuest(page, carId, {
        ...E2E_GUEST,
        email: guestEmail,
        hotelName: '',
      });
      await page.getByRole('button', { name: 'Pay with Stripe' }).click();
      await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

      const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
      const reservation = await getReservationByStripeSessionId(stripeSessionId);
      expect(reservation).toBeTruthy();

      const event = buildCheckoutCompletedEvent({
        eventId: `evt_e2e_notif_${Date.now()}`,
        sessionId: stripeSessionId,
        reservationId: reservation.id,
        carId: reservation.car_id,
        sessionIdMeta: reservation.session_id,
        amountTotal: eurosToStripeCents(Number(reservation.total_price)),
      });
      expect((await postSignedWebhook(request, event)).status()).toBe(200);

      await expect
        .poll(
          async () =>
            (await countNotificationsByType('reservation_confirmation', {
              reservationId: Number(reservation.id),
            })) >= 1,
          { timeout: 15_000 }
        )
        .toBe(true);
      await expect
        .poll(
          async () =>
            (await countNotificationsByType('admin_new_booking_alert', {
              reservationId: Number(reservation.id),
            })) >= 1,
          { timeout: 15_000 }
        )
        .toBe(true);

      const listed = await listNotificationsViaApi(request, { limit: 50, status: 'sent' });
      expect(listed.ok, JSON.stringify(listed.body)).toBeTruthy();
      const types = listed.items.map((n: { type?: string }) => n.type);
      expect(types).toContain('reservation_confirmation');
      expect(types).toContain('admin_new_booking_alert');

      await adminPage.goto('/admin/notifications');
      await expect(adminPage.getByRole('heading', { name: 'Notifications' })).toBeVisible({
        timeout: 15_000,
      });
      await adminPage.getByLabel('Status').selectOption('sent');
      await expect(adminPage.getByText('reservation_confirmation').first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(adminPage.getByText('admin_new_booking_alert').first()).toBeVisible();
      await expect(adminPage.getByText(guestEmail).first()).toBeVisible();
    });
  });
});
