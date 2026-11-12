// Import named exports from '@playwright/test'.
import { expect, test } from '@playwright/test';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  buildSearchQuery,
  // Contribute this line to the enclosing declaration or statement.
  continueToCheckoutAndFillGuest,
  // Contribute this line to the enclosing declaration or statement.
  fillHomeSearch,
  // Contribute this line to the enclosing declaration or statement.
  openOrderAndResolveConflict,
  // Contribute this line to the enclosing declaration or statement.
  parseDisplayedPrice,
  // Contribute this line to the enclosing declaration or statement.
  readOrderSummaryTotal,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/booking';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  assertReservationTotalPrice,
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  deleteDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  eurosToStripeCents,
  // Contribute this line to the enclosing declaration or statement.
  getActiveReservationForCar,
  // Contribute this line to the enclosing declaration or statement.
  getReservationByStripeSessionId,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  bumpHotelDeliveryFee,
  // Contribute this line to the enclosing declaration or statement.
  bumpSeasonSurcharge,
  // Contribute this line to the enclosing declaration or statement.
  restorePricingConfig,
  // Contribute this line to the enclosing declaration or statement.
  snapshotPricingConfig,
  // Declare the PricingConfigSnapshot TypeScript type alias.
  type PricingConfigSnapshot,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/pricing-config';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/stripe-webhook'.
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
// Import named exports from '../helpers/test-env'.
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("booking-addons", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Addons ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('GUEST-003 Booking add-ons', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 110, nights: 3 });

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
    test('toggling insurance and hotel delivery updates total, URL, and hold', async ({ page }) => {
      // Wait until the asynchronous operation resolves.
      await openOrderAndResolveConflict(page, carId, range);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Add-ons & options' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Create the base total constant.
      const baseTotal = await readOrderSummaryTotal(page);

      // Wait until the asynchronous operation resolves.
      await page.locator('label').filter({ hasText: /Basic insurance/i }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(/extras=.*insurance_basic/);
      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(async () => readOrderSummaryTotal(page), { timeout: 15_000 })
        // Call .toBeGreaterThan to perform this step.
        .toBeGreaterThan(baseTotal);

      // Create the after insurance constant.
      const afterInsurance = await readOrderSummaryTotal(page);

      // Wait until the asynchronous operation resolves.
      await page.locator('label').filter({ hasText: /Hotel delivery/i }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(/hotelDelivery=1/);
      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(async () => readOrderSummaryTotal(page), { timeout: 15_000 })
        // Call .toBeGreaterThan to perform this step.
        .toBeGreaterThan(afterInsurance);

      // Create the with hotel constant.
      const withHotel = await readOrderSummaryTotal(page);
      // Assert that the value matches the intended expectation.
      expect(withHotel).toBeGreaterThan(baseTotal);

      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(async () => {
          // Create the hold constant.
          const hold = await getActiveReservationForCar(carId);
          // Evaluate the condition and enter the branch when it is true.
          if (!hold) return null;
          // Create the extras constant.
          const extras = hold.selected_extras;
          // Create the codes constant.
          const codes = Array.isArray(extras)
            // Contribute this line to the enclosing declaration or statement.
            ? extras
            // Continue the surrounding logic with this statement.
            : typeof extras === 'string'
              // Continue the surrounding logic with this statement.
              ? JSON.parse(extras)
              // Contribute this line to the enclosing declaration or statement.
              : extras;
          // Return the resulting value to the caller.
          return {
            // Provide the hotel field value.
            hotel: Boolean(hold.hotel_delivery),
            // Provide the has insurance field value.
            hasInsurance: Array.isArray(codes) && codes.includes('insurance_basic'),
            // Provide the total field value.
            total: Number(hold.total_price),
          };
        // Continue the surrounding logic with this statement.
        }, { timeout: 15_000 })
        // Call .toEqual to perform this step.
        .toEqual(
          // Call expect.objectContaining to perform this step.
          expect.objectContaining({
            // Provide the hotel field value.
            hotel: true,
            // Provide the has insurance field value.
            hasInsurance: true,
            // Provide the total field value.
            total: withHotel,
          })
        );
    });
  });
});

// Call test.describe to perform this step.
test.describe("booking-date-boundaries", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Date Boundaries ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('MONEY-006 Date-boundary availability', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the booked constant.
    const booked = allocateFutureRange({ fromDaysAhead: 90, nights: 3 });
    // Adjacent half-open window: pickup at prior return instant is allowed.
    const adjacent = allocateFutureRange({ fromDaysAhead: 93, nights: 2 });
    // Create the overlapping constant.
    const overlapping = {
      // Provide the pickup date field value.
      pickupDate: booked.pickupDate,
      // Provide the return date field value.
      returnDate: booked.returnDate,
      // Provide the pickup time field value.
      pickupTime: booked.pickupTime,
      // Provide the return time field value.
      returnTime: booked.returnTime,
    };

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
      // Wait until the asynchronous operation resolves.
      await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the pickup date field value.
        pickupDate: booked.pickupDate,
        // Provide the return date field value.
        returnDate: booked.returnDate,
        // Provide the pickup time field value.
        pickupTime: booked.pickupTime,
        // Provide the return time field value.
        returnTime: booked.returnTime,
      });
    });

    // Define a single test case and its expectations.
    test('adjacent range still lists the car; overlapping range does not', async ({ page }) => {
      // Assert that the value matches the intended expectation.
      expect(adjacent.pickupDate).toBe(booked.returnDate);

      // Wait until the asynchronous operation resolves.
      await page.goto(`/search?${buildSearchQuery(adjacent)}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await page.goto(`/search?${buildSearchQuery(overlapping)}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: CAR_NAME })).toHaveCount(0, {
        // Provide the timeout field value.
        timeout: 15_000,
      });
    });
  });
});

// Call test.describe to perform this step.
test.describe("booking-pricing-consistency", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Price Consistency ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('MONEY-005 Same price search→Stripe→DB', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 95, nights: 4 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('price-consistency');

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
    test('search, order, and Stripe amounts match reservation snapshot', async ({ page, request }) => {
      // Wait until the asynchronous operation resolves.
      await fillHomeSearch(page, range);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });

      // Create the card constant.
      const card = page.locator('article').filter({ hasText: CAR_NAME });
      // Create the search total constant.
      const searchTotal = parseDisplayedPrice(
        // Wait until the asynchronous operation resolves.
        await card.locator('.font-display.text-2xl').innerText()
      );

      // Wait until the asynchronous operation resolves.
      await openOrderAndResolveConflict(page, carId, range);
      // Create the order total constant.
      const orderTotal = await readOrderSummaryTotal(page);
      // Assert that the value matches the intended expectation.
      expect(orderTotal).toBeCloseTo(searchTotal, 2);

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
      // Wait until the asynchronous operation resolves.
      await assertReservationTotalPrice(Number(reservation.id), orderTotal);

      // Create the amount total constant.
      const amountTotal = eurosToStripeCents(orderTotal);
      // Create the webhook event constant.
      const webhookEvent = buildCheckoutCompletedEvent({
        // Provide the event id field value.
        eventId: `evt_price_${Date.now()}`,
        // Provide the session id field value.
        sessionId: stripeSessionId,
        // Provide the reservation id field value.
        reservationId: reservation.id,
        // Provide the car id field value.
        carId: reservation.car_id,
        // Provide the session id meta field value.
        sessionIdMeta: reservation.session_id,
        // Contribute this line to the enclosing declaration or statement.
        amountTotal,
      });
      // Assert that the value matches the intended expectation.
      expect((await postSignedWebhook(request, webhookEvent)).status()).toBe(200);

      // Create the confirmed constant.
      const confirmed = await getReservationByStripeSessionId(stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(confirmed.status).toBe('confirmed');
      // Wait until the asynchronous operation resolves.
      await assertReservationTotalPrice(Number(confirmed.id), orderTotal);
    });
  });
});

// Call test.describe to perform this step.
test.describe("pricing-season-snapshot", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Season Snapshot ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Season pricing snapshot immutability (90)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Continue the surrounding logic with this statement.
    let pricingSnapshot: PricingConfigSnapshot | null = null;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 250, nights: 3 });

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
      if (pricingSnapshot) {
        // Wait until the asynchronous operation resolves.
        await restorePricingConfig(pricingSnapshot);
      }
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId).catch(() => undefined);
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('held snapshot stays fixed after season bump; new quote sees new price', async ({
      // Contribute this line to the enclosing declaration or statement.
      page,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
      // Store the awaited result in pricingSnapshot.
      pricingSnapshot = await snapshotPricingConfig();

      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await openOrderAndResolveConflict(page, carId, range);
        // Create the held total constant.
        const heldTotal = await readOrderSummaryTotal(page);
        // Create the hold constant.
        const hold = await getActiveReservationForCar(carId);
        // Assert that the value matches the intended expectation.
        expect(hold).toBeTruthy();
        // Wait until the asynchronous operation resolves.
        await assertReservationTotalPrice(Number(hold.id), heldTotal);

        // Destructure object properties into local variables.
        const { after, before } = await bumpSeasonSurcharge(25);
        // Assert that the value matches the intended expectation.
        expect(after).toBeGreaterThan(before);

        // Create the hold after bump constant.
        const holdAfterBump = await getActiveReservationForCar(carId);
        // Assert that the value matches the intended expectation.
        expect(Number(holdAfterBump.id)).toBe(Number(hold.id));
        // Wait until the asynchronous operation resolves.
        await assertReservationTotalPrice(Number(holdAfterBump.id), heldTotal);

        // Wait until the asynchronous operation resolves.
        await cleanupReservationsForCar(carId);
        // Wait until the asynchronous operation resolves.
        await openOrderAndResolveConflict(page, carId, range);
        // Wait until the asynchronous operation resolves.
        await expect(page.getByText('Total', { exact: true })).toBeVisible({ timeout: 15_000 });
        // Create the live total constant.
        const liveTotal = await readOrderSummaryTotal(page);
        // Assert that the value matches the intended expectation.
        expect(liveTotal).toBeGreaterThan(heldTotal);
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Evaluate the condition and enter the branch when it is true.
        if (pricingSnapshot) {
          // Wait until the asynchronous operation resolves.
          await restorePricingConfig(pricingSnapshot);
          // Update pricingSnapshot with the right-hand side value.
          pricingSnapshot = null;
        }
      }
    });
  });
});

// Call test.describe to perform this step.
test.describe("pricing-snapshot-immutability", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Snapshot Immutable ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('MONEY-012 Pricing snapshot immutability', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Continue the surrounding logic with this statement.
    let pricingSnapshot: PricingConfigSnapshot | null = null;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 135, nights: 3 });

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
      if (pricingSnapshot) {
        // Wait until the asynchronous operation resolves.
        await restorePricingConfig(pricingSnapshot);
      }
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('held snapshot stays fixed after live fee bump; new quote sees new price', async ({
      // Contribute this line to the enclosing declaration or statement.
      page,
      // Contribute this line to the enclosing declaration or statement.
      browser,
    // Continue the surrounding logic with this statement.
    }) => {
      // Store the awaited result in pricingSnapshot.
      pricingSnapshot = await snapshotPricingConfig();
      // Continue the surrounding logic with this statement.
      let quoteContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;

      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await openOrderAndResolveConflict(page, carId, range, { hotelDelivery: true });
        // Create the held total constant.
        const heldTotal = await readOrderSummaryTotal(page);
        // Create the hold constant.
        const hold = await getActiveReservationForCar(carId);
        // Assert that the value matches the intended expectation.
        expect(hold).toBeTruthy();
        // Assert that the value matches the intended expectation.
        expect(Boolean(hold.hotel_delivery)).toBe(true);
        // Wait until the asynchronous operation resolves.
        await assertReservationTotalPrice(Number(hold.id), heldTotal);

        // Destructure object properties into local variables.
        const { before, after } = await bumpHotelDeliveryFee(100);
        // Assert that the value matches the intended expectation.
        expect(after).toBe(before + 100);

        // Create the hold after bump constant.
        const holdAfterBump = await getActiveReservationForCar(carId);
        // Assert that the value matches the intended expectation.
        expect(holdAfterBump).toBeTruthy();
        // Assert that the value matches the intended expectation.
        expect(Number(holdAfterBump.id)).toBe(Number(hold.id));
        // Wait until the asynchronous operation resolves.
        await assertReservationTotalPrice(Number(holdAfterBump.id), heldTotal);

        // Clear leftover holds/blocks and quote from a fresh session so live config applies.
        await cleanupReservationsForCar(carId);
        // Wait until the asynchronous operation resolves.
        await deleteDateBlocksForCar(carId);
        // Store the awaited result in quoteContext.
        quoteContext = await browser.newContext();
        // Create the fresh page constant.
        const freshPage = await quoteContext.newPage();
        // Wait until the asynchronous operation resolves.
        await openOrderAndResolveConflict(freshPage, carId, range, { hotelDelivery: true });
        // Wait until the asynchronous operation resolves.
        await expect(freshPage.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
          // Provide the timeout field value.
          timeout: 20_000,
        });
        // Wait until the asynchronous operation resolves.
        await expect(freshPage.getByText('Total', { exact: true })).toBeVisible({ timeout: 15_000 });
        // Create the live total constant.
        const liveTotal = await readOrderSummaryTotal(freshPage);
        // Assert that the value matches the intended expectation.
        expect(liveTotal).toBeGreaterThan(heldTotal);
        // Assert that the value matches the intended expectation.
        expect(liveTotal).toBeCloseTo(heldTotal + 100, 2);
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Wait until the asynchronous operation resolves.
        await quoteContext?.close();
        // Evaluate the condition and enter the branch when it is true.
        if (pricingSnapshot) {
          // Wait until the asynchronous operation resolves.
          await restorePricingConfig(pricingSnapshot);
          // Update pricingSnapshot with the right-hand side value.
          pricingSnapshot = null;
        }
      }
    });
  });
});
