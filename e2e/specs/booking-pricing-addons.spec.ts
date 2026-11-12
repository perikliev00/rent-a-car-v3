import { expect, test } from '@playwright/test';
import {
  buildSearchQuery,
  continueToCheckoutAndFillGuest,
  fillHomeSearch,
  openOrderAndResolveConflict,
  parseDisplayedPrice,
  readOrderSummaryTotal,
} from '../helpers/booking';
import {
  assertReservationTotalPrice,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  deleteDateBlocksForCar,
  eurosToStripeCents,
  getActiveReservationForCar,
  getReservationByStripeSessionId,
} from '../helpers/db';
import {
  bumpHotelDeliveryFee,
  bumpSeasonSurcharge,
  restorePricingConfig,
  snapshotPricingConfig,
  type PricingConfigSnapshot,
} from '../helpers/pricing-config';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("booking-addons", () => {
  const CAR_NAME = `E2E Addons ${Date.now()}`;

  test.describe('GUEST-003 Booking add-ons', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 110, nights: 3 });

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

    test('toggling insurance and hotel delivery updates total, URL, and hold', async ({ page }) => {
      await openOrderAndResolveConflict(page, carId, range);
      await expect(page.getByRole('heading', { name: 'Add-ons & options' })).toBeVisible({
        timeout: 15_000,
      });

      const baseTotal = await readOrderSummaryTotal(page);

      await page.locator('label').filter({ hasText: /Basic insurance/i }).click();
      await expect(page).toHaveURL(/extras=.*insurance_basic/);
      await expect
        .poll(async () => readOrderSummaryTotal(page), { timeout: 15_000 })
        .toBeGreaterThan(baseTotal);

      const afterInsurance = await readOrderSummaryTotal(page);

      await page.locator('label').filter({ hasText: /Hotel delivery/i }).click();
      await expect(page).toHaveURL(/hotelDelivery=1/);
      await expect
        .poll(async () => readOrderSummaryTotal(page), { timeout: 15_000 })
        .toBeGreaterThan(afterInsurance);

      const withHotel = await readOrderSummaryTotal(page);
      expect(withHotel).toBeGreaterThan(baseTotal);

      await expect
        .poll(async () => {
          const hold = await getActiveReservationForCar(carId);
          if (!hold) return null;
          const extras = hold.selected_extras;
          const codes = Array.isArray(extras)
            ? extras
            : typeof extras === 'string'
              ? JSON.parse(extras)
              : extras;
          return {
            hotel: Boolean(hold.hotel_delivery),
            hasInsurance: Array.isArray(codes) && codes.includes('insurance_basic'),
            total: Number(hold.total_price),
          };
        }, { timeout: 15_000 })
        .toEqual(
          expect.objectContaining({
            hotel: true,
            hasInsurance: true,
            total: withHotel,
          })
        );
    });
  });
});

test.describe("booking-date-boundaries", () => {
  const CAR_NAME = `E2E Date Boundaries ${Date.now()}`;

  test.describe('MONEY-006 Date-boundary availability', () => {
    test.setTimeout(120_000);

    let carId: number;
    const booked = allocateFutureRange({ fromDaysAhead: 90, nights: 3 });
    // Adjacent half-open window: pickup at prior return instant is allowed.
    const adjacent = allocateFutureRange({ fromDaysAhead: 93, nights: 2 });
    const overlapping = {
      pickupDate: booked.pickupDate,
      returnDate: booked.returnDate,
      pickupTime: booked.pickupTime,
      returnTime: booked.returnTime,
    };

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupTestCar(carId);
    });

    test.beforeEach(async () => {
      await cleanupReservationsForCar(carId);
      await seedLinkedBooking({
        carId,
        status: 'confirmed',
        pickupDate: booked.pickupDate,
        returnDate: booked.returnDate,
        pickupTime: booked.pickupTime,
        returnTime: booked.returnTime,
      });
    });

    test('adjacent range still lists the car; overlapping range does not', async ({ page }) => {
      expect(adjacent.pickupDate).toBe(booked.returnDate);

      await page.goto(`/search?${buildSearchQuery(adjacent)}`);
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });

      await page.goto(`/search?${buildSearchQuery(overlapping)}`);
      await expect(page.getByRole('heading', { name: CAR_NAME })).toHaveCount(0, {
        timeout: 15_000,
      });
    });
  });
});

test.describe("booking-pricing-consistency", () => {
  const CAR_NAME = `E2E Price Consistency ${Date.now()}`;

  test.describe('MONEY-005 Same price search→Stripe→DB', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 95, nights: 4 });
    const guestEmail = uniqueEmail('price-consistency');

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

    test('search, order, and Stripe amounts match reservation snapshot', async ({ page, request }) => {
      await fillHomeSearch(page, range);
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });

      const card = page.locator('article').filter({ hasText: CAR_NAME });
      const searchTotal = parseDisplayedPrice(
        await card.locator('.font-display.text-2xl').innerText()
      );

      await openOrderAndResolveConflict(page, carId, range);
      const orderTotal = await readOrderSummaryTotal(page);
      expect(orderTotal).toBeCloseTo(searchTotal, 2);

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
      expect(reservation).toBeTruthy();
      await assertReservationTotalPrice(Number(reservation.id), orderTotal);

      const amountTotal = eurosToStripeCents(orderTotal);
      const webhookEvent = buildCheckoutCompletedEvent({
        eventId: `evt_price_${Date.now()}`,
        sessionId: stripeSessionId,
        reservationId: reservation.id,
        carId: reservation.car_id,
        sessionIdMeta: reservation.session_id,
        amountTotal,
      });
      expect((await postSignedWebhook(request, webhookEvent)).status()).toBe(200);

      const confirmed = await getReservationByStripeSessionId(stripeSessionId);
      expect(confirmed.status).toBe('confirmed');
      await assertReservationTotalPrice(Number(confirmed.id), orderTotal);
    });
  });
});

test.describe("pricing-season-snapshot", () => {
  const CAR_NAME = `E2E Season Snapshot ${Date.now()}`;

  test.describe('Season pricing snapshot immutability (90)', () => {
    test.setTimeout(120_000);

    let carId: number;
    let pricingSnapshot: PricingConfigSnapshot | null = null;
    const range = allocateFutureRange({ fromDaysAhead: 250, nights: 3 });

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      if (pricingSnapshot) {
        await restorePricingConfig(pricingSnapshot);
      }
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test('held snapshot stays fixed after season bump; new quote sees new price', async ({
      page,
    }) => {
      await cleanupReservationsForCar(carId);
      pricingSnapshot = await snapshotPricingConfig();

      try {
        await openOrderAndResolveConflict(page, carId, range);
        const heldTotal = await readOrderSummaryTotal(page);
        const hold = await getActiveReservationForCar(carId);
        expect(hold).toBeTruthy();
        await assertReservationTotalPrice(Number(hold.id), heldTotal);

        const { after, before } = await bumpSeasonSurcharge(25);
        expect(after).toBeGreaterThan(before);

        const holdAfterBump = await getActiveReservationForCar(carId);
        expect(Number(holdAfterBump.id)).toBe(Number(hold.id));
        await assertReservationTotalPrice(Number(holdAfterBump.id), heldTotal);

        await cleanupReservationsForCar(carId);
        await openOrderAndResolveConflict(page, carId, range);
        await expect(page.getByText('Total', { exact: true })).toBeVisible({ timeout: 15_000 });
        const liveTotal = await readOrderSummaryTotal(page);
        expect(liveTotal).toBeGreaterThan(heldTotal);
      } finally {
        if (pricingSnapshot) {
          await restorePricingConfig(pricingSnapshot);
          pricingSnapshot = null;
        }
      }
    });
  });
});

test.describe("pricing-snapshot-immutability", () => {
  const CAR_NAME = `E2E Snapshot Immutable ${Date.now()}`;

  test.describe('MONEY-012 Pricing snapshot immutability', () => {
    test.setTimeout(120_000);

    let carId: number;
    let pricingSnapshot: PricingConfigSnapshot | null = null;
    const range = allocateFutureRange({ fromDaysAhead: 135, nights: 3 });

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      if (pricingSnapshot) {
        await restorePricingConfig(pricingSnapshot);
      }
      await cleanupTestCar(carId);
    });

    test.beforeEach(async () => {
      await cleanupReservationsForCar(carId);
    });

    test('held snapshot stays fixed after live fee bump; new quote sees new price', async ({
      page,
      browser,
    }) => {
      pricingSnapshot = await snapshotPricingConfig();
      let quoteContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;

      try {
        await openOrderAndResolveConflict(page, carId, range, { hotelDelivery: true });
        const heldTotal = await readOrderSummaryTotal(page);
        const hold = await getActiveReservationForCar(carId);
        expect(hold).toBeTruthy();
        expect(Boolean(hold.hotel_delivery)).toBe(true);
        await assertReservationTotalPrice(Number(hold.id), heldTotal);

        const { before, after } = await bumpHotelDeliveryFee(100);
        expect(after).toBe(before + 100);

        const holdAfterBump = await getActiveReservationForCar(carId);
        expect(holdAfterBump).toBeTruthy();
        expect(Number(holdAfterBump.id)).toBe(Number(hold.id));
        await assertReservationTotalPrice(Number(holdAfterBump.id), heldTotal);

        // Clear leftover holds/blocks and quote from a fresh session so live config applies.
        await cleanupReservationsForCar(carId);
        await deleteDateBlocksForCar(carId);
        quoteContext = await browser.newContext();
        const freshPage = await quoteContext.newPage();
        await openOrderAndResolveConflict(freshPage, carId, range, { hotelDelivery: true });
        await expect(freshPage.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
          timeout: 20_000,
        });
        await expect(freshPage.getByText('Total', { exact: true })).toBeVisible({ timeout: 15_000 });
        const liveTotal = await readOrderSummaryTotal(freshPage);
        expect(liveTotal).toBeGreaterThan(heldTotal);
        expect(liveTotal).toBeCloseTo(heldTotal + 100, 2);
      } finally {
        await quoteContext?.close();
        if (pricingSnapshot) {
          await restorePricingConfig(pricingSnapshot);
          pricingSnapshot = null;
        }
      }
    });
  });
});
