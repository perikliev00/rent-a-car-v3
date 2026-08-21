import { expect, test } from '../fixtures/base';
import { changeOpsStatusViaApi } from '../helpers/admin-reservations';
import { continueToCheckoutAndFillGuest, openOrderAndResolveConflict } from '../helpers/booking';
import { loginAsAdmin } from '../helpers/csrf';
import {
  assertReservationStatus,
  backdateReservationCreatedAt,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  countNotificationsByType,
  countOrdersByGuestEmail,
  deleteDateBlocksForCar,
  eurosToStripeCents,
  getActiveReservationForCar,
  getReservationById,
  getReservationByStripeSessionId,
  insertDateBlock,
  setHoldExpired,
  withDb,
} from '../helpers/db';
import { runNotificationSchedulerViaApi } from '../helpers/notifications';
import { markStubSessionPaid } from '../helpers/payments';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("checkout-success-processing", () => {
  const CAR_NAME = `E2E Success Processing ${Date.now()}`;

  test.describe('Checkout success processing then confirmed (88)', () => {
    test.setTimeout(180_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 230, nights: 2 });
    const guestEmail = uniqueEmail('success-proc');

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test('shows Payment Received while stuck, then Confirmed after resolve', async ({
      page,
      request,
      adminPage,
    }) => {
      await cleanupReservationsForCar(carId);
      await deleteDateBlocksForCar(carId);

      await openOrderAndResolveConflict(page, carId, range);
      await continueToCheckoutAndFillGuest(page, carId, {
        ...E2E_GUEST,
        email: guestEmail,
        hotelName: '',
      });
      await page.getByRole('button', { name: 'Pay with Stripe' }).click();
      await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

      const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
      expect(stripeSessionId).toMatch(/^cs_test_/);

      const reservation = await getReservationByStripeSessionId(stripeSessionId);
      expect(reservation?.status).toBe('processing_payment');

      // Force paid-conflict path so success finalize cannot confirm yet.
      await setHoldExpired(Number(reservation.id));
      await insertDateBlock(
        carId,
        range.pickupDate,
        range.returnDate,
        range.pickupTime,
        range.returnTime
      );

      const adminSession = await loginAsAdmin(request);
      const marked = await markStubSessionPaid(request, adminSession, stripeSessionId);
      expect(marked.status, JSON.stringify(marked.body)).toBe(200);

      // Webhook (or success finalize) lands in manual_review — not silent confirmed.
      const event = buildCheckoutCompletedEvent({
        eventId: `evt_e2e_proc_${Date.now()}`,
        sessionId: stripeSessionId,
        reservationId: reservation.id,
        carId: reservation.car_id,
        sessionIdMeta: reservation.session_id,
        amountTotal: eurosToStripeCents(Number(reservation.total_price)),
      });
      expect((await postSignedWebhook(request, event)).status()).toBe(200);

      await assertReservationStatus(Number(reservation.id), 'manual_review');

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Payment Received' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toHaveCount(0);
      await expect(page.getByText(/confirming your booking/i)).toBeVisible();

      await adminPage.goto('/admin/reservations');
      await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
        timeout: 15_000,
      });
      await adminPage.getByRole('button', { name: 'Refresh' }).click();
      await expect(
        adminPage.getByRole('button', { name: String(reservation.id), exact: true }).first()
      ).toBeVisible({ timeout: 15_000 });

      await deleteDateBlocksForCar(carId);
      const confirm = await changeOpsStatusViaApi(
        request,
        reservation.id,
        'confirmed',
        adminSession
      );
      expect(confirm.ok, JSON.stringify(confirm.body)).toBeTruthy();

      await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toBeVisible({
        timeout: 20_000,
      });

      const confirmed = await getReservationByStripeSessionId(stripeSessionId);
      expect(confirmed.status).toBe('confirmed');
    });
  });
});

test.describe("checkout-success-invalid", () => {
  test.describe('Checkout success invalid session (87)', () => {
    test.setTimeout(60_000);

    test('missing session_id shows clear error and no confirmed booking', async ({ page }) => {
      const confirmedBefore = await withDb(async (client) => {
        const result = await client.query(
          `SELECT COUNT(*)::int AS count FROM reservations WHERE status = 'confirmed'`
        );
        return result.rows[0].count as number;
      });

      await page.goto('/checkout/success');
      await expect(page.getByRole('heading', { name: 'No payment session' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Go home' }).first()).toBeVisible();

      const confirmedAfter = await withDb(async (client) => {
        const result = await client.query(
          `SELECT COUNT(*)::int AS count FROM reservations WHERE status = 'confirmed'`
        );
        return result.rows[0].count as number;
      });
      expect(confirmedAfter).toBe(confirmedBefore);
    });

    test('bad session_id fails verification without Booking Confirmed', async ({ page }) => {
      await page.goto('/checkout/success?session_id=cs_test_not_a_real_session_xyz');
      await expect(page.getByRole('heading', { name: 'Payment verification failed' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Go home' }).first()).toBeVisible();
      expect(await countOrdersByGuestEmail('no-such-guest@example.com')).toBe(0);
    });
  });
});

test.describe("checkout-validation-retry", () => {
  const CAR_NAME = `E2E Checkout Retry ${Date.now()}`;

  test.describe('GUEST-005 Checkout validation retry', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 130, nights: 3 });
    const guestEmail = uniqueEmail('checkout-retry');

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

    test('empty submit keeps hold; then filled Pay reaches stub success', async ({ page }) => {
      await openOrderAndResolveConflict(page, carId, range);
      await page.getByRole('button', { name: 'Continue to checkout' }).click();
      await page.waitForURL(new RegExp(`/checkout/${carId}`));

      const holdBefore = await getActiveReservationForCar(carId);
      expect(holdBefore).toBeTruthy();
      expect(['pending_payment', 'processing_payment']).toContain(holdBefore.status);

      await page.getByRole('button', { name: 'Pay with Stripe' }).click();
      await expect(page).toHaveURL(new RegExp(`/checkout/${carId}`));

      const holdAfterEmpty = await getActiveReservationForCar(carId);
      expect(holdAfterEmpty).toBeTruthy();
      expect(Number(holdAfterEmpty.id)).toBe(Number(holdBefore.id));
      expect(['pending_payment', 'processing_payment']).toContain(holdAfterEmpty.status);

      await page.getByLabel('Full name').fill(E2E_GUEST.fullName);
      await page.getByLabel('Phone number').fill(E2E_GUEST.phoneNumber);
      await page.getByLabel('Email').fill(guestEmail);
      await page.getByLabel('Address').fill(E2E_GUEST.address);

      await page.getByRole('button', { name: 'Pay with Stripe' }).click();
      await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });
      expect(new URL(page.url()).searchParams.get('session_id')).toMatch(/^cs_test_/);
    });
  });
});

test.describe("checkout-cancel-noop", () => {
  const CAR_NAME = `E2E Cancel Noop ${Date.now()}`;

  test.describe('Checkout cancel with nothing to cancel (102)', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 80, nights: 2 });
    const foreignEmail = uniqueEmail('foreign-hold');

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test.beforeEach(async () => {
      await cleanupReservationsForCar(carId);
    });

    async function openCancelInFreshContext(
      browser: import('@playwright/test').Browser
    ): Promise<{ page: import('@playwright/test').Page; context: import('@playwright/test').BrowserContext }> {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('/');
      await page.goto('/checkout/cancel');
      return { page, context };
    }

    test('cold cancel shows calm message and does not touch foreign hold', async ({ browser }) => {
      const foreign = await seedLinkedBooking({
        carId,
        status: 'pending_payment',
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        guest: { ...E2E_GUEST, email: foreignEmail, fullName: 'Foreign Hold' },
      });

      const { page, context } = await openCancelInFreshContext(browser);
      try {
        await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible({
          timeout: 15_000,
        });
        await expect(page.getByTestId('checkout-cancel-message')).toHaveText(
          /No active reservation hold to cancel/i,
          { timeout: 15_000 }
        );

        await assertReservationStatus(foreign.reservationId, 'pending_payment');
        const row = await getReservationById(foreign.reservationId);
        expect(row.status).toBe('pending_payment');
      } finally {
        await context.close();
      }
    });

    test('cancel after confirmed booking does not cancel that reservation', async ({ browser }) => {
      const confirmed = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        guest: { ...E2E_GUEST, email: uniqueEmail('confirmed-noop'), fullName: 'Confirmed Noop' },
      });

      const { page, context } = await openCancelInFreshContext(browser);
      try {
        await expect(page.getByTestId('checkout-cancel-message')).toHaveText(
          /No active reservation hold to cancel/i,
          { timeout: 15_000 }
        );
        await assertReservationStatus(confirmed.reservationId, 'confirmed');
      } finally {
        await context.close();
      }
    });
  });
});

test.describe("abandoned-checkout-reminder", () => {
  const CAR_NAME = `E2E Abandoned Reminder ${Date.now()}`;

  test.describe('Abandoned checkout reminder (92)', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 270, nights: 2 });
    const guestEmail = uniqueEmail('abandon-rem');

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test('scheduler enqueues abandoned_checkout_reminder while hold is still pending', async ({
      request,
      adminPage,
    }) => {
      await cleanupReservationsForCar(carId);

      // Seed hold with email already on the row (checkout form alone does not persist email).
      const seeded = await seedLinkedBooking({
        carId,
        status: 'pending_payment',
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        withOrder: false,
        withBlock: false,
        holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Abandon Reminder Guest' },
      });
      const reservationId = seeded.reservationId;

      await backdateReservationCreatedAt(reservationId, 30);

      const run = await runNotificationSchedulerViaApi(request);
      expect(run.ok, JSON.stringify(run.body)).toBeTruthy();

      await expect
        .poll(
          async () =>
            countNotificationsByType('abandoned_checkout_reminder', { reservationId }),
          { timeout: 15_000 }
        )
        .toBeGreaterThanOrEqual(1);

      expect(
        await countNotificationsByType('abandoned_checkout_reminder', {
          reservationId,
          status: 'sent',
        })
      ).toBeGreaterThanOrEqual(1);

      await assertReservationStatus(reservationId, 'pending_payment');

      await adminPage.goto('/admin/notifications');
      await expect(adminPage.getByRole('heading', { name: 'Notifications' })).toBeVisible({
        timeout: 15_000,
      });
      await adminPage.getByLabel('Status').selectOption('sent');
      await expect(adminPage.getByText('abandoned_checkout_reminder').first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(adminPage.getByText(guestEmail).first()).toBeVisible();
    });
  });
});
