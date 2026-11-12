// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/admin-reservations'.
import { changeOpsStatusViaApi } from '../helpers/admin-reservations';
// Import named exports from '../helpers/booking'.
import { continueToCheckoutAndFillGuest, openOrderAndResolveConflict } from '../helpers/booking';
// Import named exports from '../helpers/csrf'.
import { loginAsAdmin } from '../helpers/csrf';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  assertReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  backdateReservationCreatedAt,
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  countNotificationsByType,
  // Contribute this line to the enclosing declaration or statement.
  countOrdersByGuestEmail,
  // Contribute this line to the enclosing declaration or statement.
  deleteDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  eurosToStripeCents,
  // Contribute this line to the enclosing declaration or statement.
  getActiveReservationForCar,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getReservationByStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  insertDateBlock,
  // Contribute this line to the enclosing declaration or statement.
  setHoldExpired,
  // Contribute this line to the enclosing declaration or statement.
  withDb,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/notifications'.
import { runNotificationSchedulerViaApi } from '../helpers/notifications';
// Import named exports from '../helpers/payments'.
import { markStubSessionPaid } from '../helpers/payments';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/stripe-webhook'.
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
// Import named exports from '../helpers/test-env'.
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("checkout-success-processing", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Success Processing ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Checkout success processing then confirmed (88)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 230, nights: 2 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('success-proc');

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
    test('shows Payment Received while stuck, then Confirmed after resolve', async ({
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
      await deleteDateBlocksForCar(carId);

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
      // Assert that the value matches the intended expectation.
      expect(stripeSessionId).toMatch(/^cs_test_/);

      // Create the reservation constant.
      const reservation = await getReservationByStripeSessionId(stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(reservation?.status).toBe('processing_payment');

      // Force paid-conflict path so success finalize cannot confirm yet.
      await setHoldExpired(Number(reservation.id));
      // Wait until the asynchronous operation resolves.
      await insertDateBlock(
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        range.pickupDate,
        // Contribute this line to the enclosing declaration or statement.
        range.returnDate,
        // Contribute this line to the enclosing declaration or statement.
        range.pickupTime,
        // Contribute this line to the enclosing declaration or statement.
        range.returnTime
      );

      // Create the admin session constant.
      const adminSession = await loginAsAdmin(request);
      // Create the marked constant.
      const marked = await markStubSessionPaid(request, adminSession, stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(marked.status, JSON.stringify(marked.body)).toBe(200);

      // Webhook (or success finalize) lands in manual_review — not silent confirmed.
      const event = buildCheckoutCompletedEvent({
        // Provide the event id field value.
        eventId: `evt_e2e_proc_${Date.now()}`,
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
      await assertReservationStatus(Number(reservation.id), 'manual_review');

      // Wait until the asynchronous operation resolves.
      await page.reload();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Payment Received' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(/confirming your booking/i)).toBeVisible();

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
        adminPage.getByRole('button', { name: String(reservation.id), exact: true }).first()
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await deleteDateBlocksForCar(carId);
      // Create the confirm constant.
      const confirm = await changeOpsStatusViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        reservation.id,
        // Supply the literal value used by the enclosing expression.
        'confirmed',
        // Reference the identifier used by the enclosing expression.
        adminSession
      );
      // Assert that the value matches the intended expectation.
      expect(confirm.ok, JSON.stringify(confirm.body)).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 20_000,
      });

      // Create the confirmed constant.
      const confirmed = await getReservationByStripeSessionId(stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(confirmed.status).toBe('confirmed');
    });
  });
});

// Call test.describe to perform this step.
test.describe("checkout-success-invalid", () => {
  // Call test.describe to perform this step.
  test.describe('Checkout success invalid session (87)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(60_000);

    // Define a single test case and its expectations.
    test('missing session_id shows clear error and no confirmed booking', async ({ page }) => {
      // Create the confirmed before constant.
      const confirmedBefore = await withDb(async (client) => {
        // Create the result constant.
        const result = await client.query(
          // Continue the surrounding logic with this statement.
          `SELECT COUNT(*)::int AS count FROM reservations WHERE status = 'confirmed'`
        );
        // Return the resulting value to the caller.
        return result.rows[0].count as number;
      });

      // Wait until the asynchronous operation resolves.
      await page.goto('/checkout/success');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'No payment session' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('button', { name: 'Go home' }).first()).toBeVisible();

      // Create the confirmed after constant.
      const confirmedAfter = await withDb(async (client) => {
        // Create the result constant.
        const result = await client.query(
          // Continue the surrounding logic with this statement.
          `SELECT COUNT(*)::int AS count FROM reservations WHERE status = 'confirmed'`
        );
        // Return the resulting value to the caller.
        return result.rows[0].count as number;
      });
      // Assert that the value matches the intended expectation.
      expect(confirmedAfter).toBe(confirmedBefore);
    });

    // Define a single test case and its expectations.
    test('bad session_id fails verification without Booking Confirmed', async ({ page }) => {
      // Wait until the asynchronous operation resolves.
      await page.goto('/checkout/success?session_id=cs_test_not_a_real_session_xyz');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Payment verification failed' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('button', { name: 'Go home' }).first()).toBeVisible();
      // Assert that the value matches the intended expectation.
      expect(await countOrdersByGuestEmail('no-such-guest@example.com')).toBe(0);
    });
  });
});

// Call test.describe to perform this step.
test.describe("checkout-validation-retry", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Checkout Retry ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('GUEST-005 Checkout validation retry', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 130, nights: 3 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('checkout-retry');

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
    test('empty submit keeps hold; then filled Pay reaches stub success', async ({ page }) => {
      // Wait until the asynchronous operation resolves.
      await openOrderAndResolveConflict(page, carId, range);
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Continue to checkout' }).click();
      // Wait until the asynchronous operation resolves.
      await page.waitForURL(new RegExp(`/checkout/${carId}`));

      // Create the hold before constant.
      const holdBefore = await getActiveReservationForCar(carId);
      // Assert that the value matches the intended expectation.
      expect(holdBefore).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(['pending_payment', 'processing_payment']).toContain(holdBefore.status);

      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Pay with Stripe' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(new RegExp(`/checkout/${carId}`));

      // Create the hold after empty constant.
      const holdAfterEmpty = await getActiveReservationForCar(carId);
      // Assert that the value matches the intended expectation.
      expect(holdAfterEmpty).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(Number(holdAfterEmpty.id)).toBe(Number(holdBefore.id));
      // Assert that the value matches the intended expectation.
      expect(['pending_payment', 'processing_payment']).toContain(holdAfterEmpty.status);

      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Full name').fill(E2E_GUEST.fullName);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Phone number').fill(E2E_GUEST.phoneNumber);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Email').fill(guestEmail);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Address').fill(E2E_GUEST.address);

      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Pay with Stripe' }).click();
      // Wait until the asynchronous operation resolves.
      await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });
      // Assert that the value matches the intended expectation.
      expect(new URL(page.url()).searchParams.get('session_id')).toMatch(/^cs_test_/);
    });
  });
});

// Call test.describe to perform this step.
test.describe("checkout-cancel-noop", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cancel Noop ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Checkout cancel with nothing to cancel (102)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 80, nights: 2 });
    // Create the foreign email constant.
    const foreignEmail = uniqueEmail('foreign-hold');

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

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define the async function openCancelInFreshContext.
    async function openCancelInFreshContext(
      // Provide the browser field value.
      browser: import('@playwright/test').Browser
    // Continue the surrounding logic with this statement.
    ): Promise<{ page: import('@playwright/test').Page; context: import('@playwright/test').BrowserContext }> {
      // Create the context constant.
      const context = await browser.newContext();
      // Create the page constant.
      const page = await context.newPage();
      // Wait until the asynchronous operation resolves.
      await page.goto('/');
      // Wait until the asynchronous operation resolves.
      await page.goto('/checkout/cancel');
      // Return the resulting value to the caller.
      return { page, context };
    }

    // Define a single test case and its expectations.
    test('cold cancel shows calm message and does not touch foreign hold', async ({ browser }) => {
      // Create the foreign constant.
      const foreign = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'pending_payment',
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: foreignEmail, fullName: 'Foreign Hold' },
      });

      // Destructure object properties into local variables.
      const { page, context } = await openCancelInFreshContext(browser);
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible({
          // Provide the timeout field value.
          timeout: 15_000,
        });
        // Wait until the asynchronous operation resolves.
        await expect(page.getByTestId('checkout-cancel-message')).toHaveText(
          // Contribute this line to the enclosing declaration or statement.
          /No active reservation hold to cancel/i,
          // Contribute this line to the enclosing declaration or statement.
          { timeout: 15_000 }
        );

        // Wait until the asynchronous operation resolves.
        await assertReservationStatus(foreign.reservationId, 'pending_payment');
        // Create the row constant.
        const row = await getReservationById(foreign.reservationId);
        // Assert that the value matches the intended expectation.
        expect(row.status).toBe('pending_payment');
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Wait until the asynchronous operation resolves.
        await context.close();
      }
    });

    // Define a single test case and its expectations.
    test('cancel after confirmed booking does not cancel that reservation', async ({ browser }) => {
      // Create the confirmed constant.
      const confirmed = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: uniqueEmail('confirmed-noop'), fullName: 'Confirmed Noop' },
      });

      // Destructure object properties into local variables.
      const { page, context } = await openCancelInFreshContext(browser);
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible({
          // Provide the timeout field value.
          timeout: 15_000,
        });
        // Wait until the asynchronous operation resolves.
        await expect(page.getByTestId('checkout-cancel-message')).toHaveText(
          // Contribute this line to the enclosing declaration or statement.
          /No active reservation hold to cancel/i,
          // Contribute this line to the enclosing declaration or statement.
          { timeout: 15_000 }
        );
        // Wait until the asynchronous operation resolves.
        await assertReservationStatus(confirmed.reservationId, 'confirmed');
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Wait until the asynchronous operation resolves.
        await context.close();
      }
    });
  });
});

// Call test.describe to perform this step.
test.describe("abandoned-checkout-reminder", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Abandoned Reminder ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Abandoned checkout reminder (92)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 270, nights: 2 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('abandon-rem');

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
    test('scheduler enqueues abandoned_checkout_reminder while hold is still pending', async ({
      // Contribute this line to the enclosing declaration or statement.
      request,
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);

      // Seed hold with email already on the row (checkout form alone does not persist email).
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'pending_payment',
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the with order field value.
        withOrder: false,
        // Provide the with block field value.
        withBlock: false,
        // Provide the hold expires at field value.
        holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Abandon Reminder Guest' },
      });
      // Create the reservation id constant.
      const reservationId = seeded.reservationId;

      // Wait until the asynchronous operation resolves.
      await backdateReservationCreatedAt(reservationId, 30);

      // Create the run constant.
      const run = await runNotificationSchedulerViaApi(request);
      // Assert that the value matches the intended expectation.
      expect(run.ok, JSON.stringify(run.body)).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(
          // Call async to perform this step.
          async () =>
            // Call countNotificationsByType to perform this step.
            countNotificationsByType('abandoned_checkout_reminder', { reservationId }),
          // Contribute this line to the enclosing declaration or statement.
          { timeout: 15_000 }
        )
        // Call .toBeGreaterThanOrEqual to perform this step.
        .toBeGreaterThanOrEqual(1);

      // Assert that the value matches the intended expectation.
      expect(
        // Wait until the asynchronous operation resolves.
        await countNotificationsByType('abandoned_checkout_reminder', {
          // Contribute this line to the enclosing declaration or statement.
          reservationId,
          // Provide the status field value.
          status: 'sent',
        })
      // Continue the surrounding logic with this statement.
      ).toBeGreaterThanOrEqual(1);

      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(reservationId, 'pending_payment');

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
      await expect(adminPage.getByText('abandoned_checkout_reminder').first()).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(guestEmail).first()).toBeVisible();
    });
  });
});
