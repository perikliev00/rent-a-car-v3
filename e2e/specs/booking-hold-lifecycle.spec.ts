// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/account'.
import { applySessionCookies } from '../helpers/account';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  buildOrderUrl,
  // Contribute this line to the enclosing declaration or statement.
  continueToCheckoutAndFillGuest,
  // Contribute this line to the enclosing declaration or statement.
  fillHomeSearch,
  // Contribute this line to the enclosing declaration or statement.
  openOrderAndResolveConflict,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/booking';
// Import named exports from '../helpers/dates'.
import { parseSofiaDate } from '../helpers/dates';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  assertReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  countActiveReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  countDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  countOrdersForCar,
  // Contribute this line to the enclosing declaration or statement.
  eurosToStripeCents,
  // Contribute this line to the enclosing declaration or statement.
  expireAbandonedHold,
  // Contribute this line to the enclosing declaration or statement.
  getActiveReservationForCar,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getReservationByStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  withDb,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/fleet'.
import { searchPublicCars } from '../helpers/fleet';
// Import named exports from '../helpers/hold-race'.
import { raceGuestHoldsViaApi } from '../helpers/hold-race';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/stripe-webhook'.
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
// Import named exports from '../helpers/test-env'.
import { API_URL, E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("booking-hold-expiry", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Hold Expiry ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Hold TTL expiry (79)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Contribute this line to the enclosing declaration or statement.
    let reservationId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 130, nights: 2 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('hold-ttl');

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
    test('expired hold frees search availability and shows in Failed / Expired', async ({
      // Contribute this line to the enclosing declaration or statement.
      request,
      // Contribute this line to the enclosing declaration or statement.
      page,
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);

      // Create the seeded constant.
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
        // Provide the hold expires at field value.
        holdExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
        // Provide the with order field value.
        withOrder: false,
        // Provide the with block field value.
        withBlock: false,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Hold TTL Guest' },
      });
      // Update reservationId with the right-hand side value.
      reservationId = seeded.reservationId;

      // Assert that the value matches the intended expectation.
      expect(await countActiveReservationsForCar(carId)).toBe(0);

      // Wait until the asynchronous operation resolves.
      await expireAbandonedHold(reservationId);
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(reservationId, 'expired');

      // Create the row constant.
      const row = await getReservationById(reservationId);
      // Assert that the value matches the intended expectation.
      expect(row.status).toBe('expired');
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(0);
      // Assert that the value matches the intended expectation.
      expect(await countActiveReservationsForCar(carId)).toBe(0);

      // Create the search constant.
      const search = await searchPublicCars(request, {
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
      });
      // Assert that the value matches the intended expectation.
      expect(search.status).toBe(200);
      // Assert that the value matches the intended expectation.
      expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(true);

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
        adminPage.getByRole('heading', { name: 'Failed / Expired Payments', exact: true })
      // Continue the surrounding logic with this statement.
      ).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(guestEmail).first()).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByRole to perform this step.
        adminPage.getByRole('button', { name: String(reservationId), exact: true }).first()
      // Continue the surrounding logic with this statement.
      ).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await fillHomeSearch(page, range);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
    });
  });
});

// Call test.describe to perform this step.
test.describe("booking-rehold-success", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Rehold ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('GUEST-004 Booking rehold success', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range a constant.
    const rangeA = allocateFutureRange({ fromDaysAhead: 115, nights: 3 });
    // Create the range b constant.
    const rangeB = allocateFutureRange({ fromDaysAhead: 125, nights: 2 });

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
    test('release & rehold moves active hold to the new date range', async ({ page }) => {
      // Wait until the asynchronous operation resolves.
      await openOrderAndResolveConflict(page, carId, rangeA);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible();

      // Create the hold a constant.
      const holdA = await getActiveReservationForCar(carId);
      // Assert that the value matches the intended expectation.
      expect(holdA).toBeTruthy();
      // Create the hold aid constant.
      const holdAId = Number(holdA.id);

      // Wait until the asynchronous operation resolves.
      await page.goto(buildOrderUrl(carId, rangeB));
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call page.getByText to perform this step.
        page.getByText(/already reserved|already booked|already have an active/i)
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Release & rehold this car' }).click({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await expect.poll(async () => countActiveReservationsForCar(carId)).toBe(1);

      // Create the hold b constant.
      const holdB = await getActiveReservationForCar(carId);
      // Assert that the value matches the intended expectation.
      expect(holdB).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(Number(holdB.id)).toBe(holdAId);

      // Create the pickup b constant.
      const pickupB = parseSofiaDate(rangeB.pickupDate, rangeB.pickupTime)!;
      // Create the return b constant.
      const returnB = parseSofiaDate(rangeB.returnDate, rangeB.returnTime)!;
      // Assert that the value matches the intended expectation.
      expect(new Date(holdB.pickup_date).getTime()).toBe(pickupB.getTime());
      // Assert that the value matches the intended expectation.
      expect(new Date(holdB.return_date).getTime()).toBe(returnB.getTime());

      // Create the prior constant.
      const prior = await withDb(async (client) => {
        // Create the result constant.
        const result = await client.query(
          // Continue the surrounding logic with this statement.
          `SELECT status FROM reservations WHERE id = $1`,
          // Contribute this line to the enclosing declaration or statement.
          [holdAId]
        );
        // Return the resulting value to the caller.
        return result.rows[0]?.status as string;
      });
      // Assert that the value matches the intended expectation.
      expect(prior).toBe('pending_payment');
    });
  });
});

// Call test.describe to perform this step.
test.describe("booking-concurrent-hold", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Concurrent Hold ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('CROSS concurrent hold race (78)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 120, nights: 3 });

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
    test('exactly one guest wins the hold; loser cannot book; winner confirms', async ({
      // Contribute this line to the enclosing declaration or statement.
      browser,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);

      // Destructure object properties into local variables.
      const { winner, loser } = await raceGuestHoldsViaApi(request, carId, range);
      // Assert that the value matches the intended expectation.
      expect(winner.body?.success).toBe(true);
      // Assert that the value matches the intended expectation.
      expect(loser.body?.success).toBe(false);
      // Assert that the value matches the intended expectation.
      expect(loser.body?.error?.code).toBe('CONFLICT');
      // Assert that the value matches the intended expectation.
      expect(await countActiveReservationsForCar(carId)).toBe(1);

      // Create the hold constant.
      const hold = await getActiveReservationForCar(carId);
      // Assert that the value matches the intended expectation.
      expect(hold).toBeTruthy();

      // Create the winner context constant.
      const winnerContext = await browser.newContext();
      // Create the loser context constant.
      const loserContext = await browser.newContext();
      // Create the winner page constant.
      const winnerPage = await winnerContext.newPage();
      // Create the loser page constant.
      const loserPage = await loserContext.newPage();

      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await applySessionCookies(winnerPage, winner.session);
        // Also set cookies for API origin used by the SPA.
        const pairs = winner.session.cookieHeader
          // Call .split to perform this step.
          .split(';')
          // Call .map to perform this step.
          .map((p) => p.trim())
          // Call .filter to perform this step.
          .filter(Boolean)
          // Call .map to perform this step.
          .map((pair) => {
            // Create the eq constant.
            const eq = pair.indexOf('=');
            // Return the resulting value to the caller.
            return {
              // Provide the name field value.
              name: eq > 0 ? pair.slice(0, eq) : pair,
              // Provide the value field value.
              value: eq > 0 ? pair.slice(eq + 1) : '',
              // Provide the url field value.
              url: API_URL,
            };
          });
        // Evaluate the condition and enter the branch when it is true.
        if (pairs.length) await winnerContext.addCookies(pairs);

        // Wait until the asynchronous operation resolves.
        await winnerPage.goto(buildOrderUrl(carId, range));
        // Wait until the asynchronous operation resolves.
        await expect(winnerPage.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
          // Provide the timeout field value.
          timeout: 20_000,
        });

        // Create the winner email constant.
        const winnerEmail = uniqueEmail('hold-win');
        // Wait until the asynchronous operation resolves.
        await continueToCheckoutAndFillGuest(winnerPage, carId, {
          // Spread E2E_GUEST into the surrounding structure.
          ...E2E_GUEST,
          // Provide the email field value.
          email: winnerEmail,
          // Provide the hotel name field value.
          hotelName: '',
        });
        // Wait until the asynchronous operation resolves.
        await winnerPage.getByRole('button', { name: 'Pay with Stripe' }).click();
        // Wait until the asynchronous operation resolves.
        await winnerPage.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

        // Create the stripe session id constant.
        const stripeSessionId =
          // Continue the surrounding logic with this statement.
          new URL(winnerPage.url()).searchParams.get('session_id') || '';
        // Assert that the value matches the intended expectation.
        expect(stripeSessionId).toMatch(/^cs_test_/);

        // Create the reservation constant.
        const reservation = await getReservationByStripeSessionId(stripeSessionId);
        // Assert that the value matches the intended expectation.
        expect(reservation?.status).toBe('processing_payment');

        // Create the webhook event constant.
        const webhookEvent = buildCheckoutCompletedEvent({
          // Provide the event id field value.
          eventId: `evt_e2e_concurrent_${Date.now()}`,
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
        // Create the webhook res constant.
        const webhookRes = await postSignedWebhook(request, webhookEvent);
        // Assert that the value matches the intended expectation.
        expect(webhookRes.status()).toBe(200);

        // Create the confirmed constant.
        const confirmed = await getReservationByStripeSessionId(stripeSessionId);
        // Assert that the value matches the intended expectation.
        expect(confirmed.status).toBe('confirmed');
        // Assert that the value matches the intended expectation.
        expect(await countOrdersForCar(carId)).toBe(1);
        // Assert that the value matches the intended expectation.
        expect(await countActiveReservationsForCar(carId)).toBe(0);

        // Wait until the asynchronous operation resolves.
        await applySessionCookies(loserPage, loser.session);
        // Wait until the asynchronous operation resolves.
        await loserPage.goto(buildOrderUrl(carId, range));
        // Wait until the asynchronous operation resolves.
        await expect(loserPage.getByRole('heading', { name: 'Review your booking' })).toHaveCount(0, {
          // Provide the timeout field value.
          timeout: 15_000,
        });
        // Wait until the asynchronous operation resolves.
        await expect(
          // Call loserPage.getByText to perform this step.
          loserPage.getByText(/already reserved|different dates|different car/i).first()
        // Continue the surrounding logic with this statement.
        ).toBeVisible({ timeout: 15_000 });

        // Wait until the asynchronous operation resolves.
        await fillHomeSearch(loserPage, range);
        // Wait until the asynchronous operation resolves.
        await expect(loserPage.getByRole('heading', { name: CAR_NAME })).toHaveCount(0);

        // Create the search constant.
        const search = await searchPublicCars(request, {
          // Provide the pickup date field value.
          pickupDate: range.pickupDate,
          // Provide the return date field value.
          returnDate: range.returnDate,
          // Provide the pickup time field value.
          pickupTime: range.pickupTime,
          // Provide the return time field value.
          returnTime: range.returnTime,
        });
        // Assert that the value matches the intended expectation.
        expect(search.status).toBe(200);
        // Assert that the value matches the intended expectation.
        expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(false);
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Wait until the asynchronous operation resolves.
        await winnerContext.close();
        // Wait until the asynchronous operation resolves.
        await loserContext.close();
      }
    });
  });
});

// Call test.describe to perform this step.
test.describe("booking-stripe-cancel", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Stripe Cancel ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Stripe cancel mid-checkout (86)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 220, nights: 2 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('stripe-cancel');

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
    test('cancel URL releases pending_payment hold and frees search', async ({ page, request }) => {
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

      // Create the hold constant.
      const hold = await getActiveReservationForCar(carId);
      // Assert that the value matches the intended expectation.
      expect(hold).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(hold.status).toBe('pending_payment');
      // Create the reservation id constant.
      const reservationId = Number(hold.id);

      // Simulate Stripe back/cancel without completing payment (stub has no cancel_url UI).
      await page.goto('/checkout/cancel');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(/hold has been released/i).first()).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(reservationId, 'cancelled');
      // Assert that the value matches the intended expectation.
      expect(await countActiveReservationsForCar(carId)).toBe(0);

      // Create the search constant.
      const search = await searchPublicCars(request, {
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
      });
      // Assert that the value matches the intended expectation.
      expect(search.status).toBe(200);
      // Assert that the value matches the intended expectation.
      expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(true);

      // Wait until the asynchronous operation resolves.
      await fillHomeSearch(page, range);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
    });
  });
});

// Call test.describe to perform this step.
test.describe("booking-cancel", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cancel Car ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Booking cancel path', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 85, nights: 3 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('cancel');

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
    test('guest can cancel checkout and release the hold', async ({ page }) => {
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
      expect(reservation).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(reservation.status).toBe('processing_payment');

      // Wait until the asynchronous operation resolves.
      await page.goto('/checkout/cancel');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Create the after cancel constant.
      const afterCancel = await getReservationByStripeSessionId(stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(afterCancel.status).toBe('cancelled');
      // Assert that the value matches the intended expectation.
      expect(await countActiveReservationsForCar(carId)).toBe(0);
    });
  });
});
