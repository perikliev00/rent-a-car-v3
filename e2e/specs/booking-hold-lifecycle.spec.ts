import { expect, test } from '../fixtures/base';
import { applySessionCookies } from '../helpers/account';
import {
  buildOrderUrl,
  continueToCheckoutAndFillGuest,
  fillHomeSearch,
  openOrderAndResolveConflict,
} from '../helpers/booking';
import { parseSofiaDate } from '../helpers/dates';
import {
  assertReservationStatus,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  countActiveReservationsForCar,
  countDateBlocksForCar,
  countOrdersForCar,
  eurosToStripeCents,
  expireAbandonedHold,
  getActiveReservationForCar,
  getReservationById,
  getReservationByStripeSessionId,
  withDb,
} from '../helpers/db';
import { searchPublicCars } from '../helpers/fleet';
import { raceGuestHoldsViaApi } from '../helpers/hold-race';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
import { API_URL, E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("booking-hold-expiry", () => {
  const CAR_NAME = `E2E Hold Expiry ${Date.now()}`;

  test.describe('Hold TTL expiry (79)', () => {
    test.setTimeout(120_000);

    let carId: number;
    let reservationId: number;
    const range = allocateFutureRange({ fromDaysAhead: 130, nights: 2 });
    const guestEmail = uniqueEmail('hold-ttl');

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test('expired hold frees search availability and shows in Failed / Expired', async ({
      request,
      page,
      adminPage,
    }) => {
      await cleanupReservationsForCar(carId);

      const seeded = await seedLinkedBooking({
        carId,
        status: 'pending_payment',
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        holdExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
        withOrder: false,
        withBlock: false,
        guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Hold TTL Guest' },
      });
      reservationId = seeded.reservationId;

      expect(await countActiveReservationsForCar(carId)).toBe(0);

      await expireAbandonedHold(reservationId);
      await assertReservationStatus(reservationId, 'expired');

      const row = await getReservationById(reservationId);
      expect(row.status).toBe('expired');
      expect(await countDateBlocksForCar(carId)).toBe(0);
      expect(await countActiveReservationsForCar(carId)).toBe(0);

      const search = await searchPublicCars(request, {
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
      });
      expect(search.status).toBe(200);
      expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(true);

      await adminPage.goto('/admin/reservations');
      await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
        timeout: 15_000,
      });
      await adminPage.getByRole('button', { name: 'Refresh' }).click();
      await expect(
        adminPage.getByRole('heading', { name: 'Failed / Expired Payments', exact: true })
      ).toBeVisible();
      await expect(adminPage.getByText(guestEmail).first()).toBeVisible({ timeout: 15_000 });
      await expect(
        adminPage.getByRole('button', { name: String(reservationId), exact: true }).first()
      ).toBeVisible();

      await fillHomeSearch(page, range);
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});

test.describe("booking-rehold-success", () => {
  const CAR_NAME = `E2E Rehold ${Date.now()}`;

  test.describe('GUEST-004 Booking rehold success', () => {
    test.setTimeout(120_000);

    let carId: number;
    const rangeA = allocateFutureRange({ fromDaysAhead: 115, nights: 3 });
    const rangeB = allocateFutureRange({ fromDaysAhead: 125, nights: 2 });

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

    test('release & rehold moves active hold to the new date range', async ({ page }) => {
      await openOrderAndResolveConflict(page, carId, rangeA);
      await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible();

      const holdA = await getActiveReservationForCar(carId);
      expect(holdA).toBeTruthy();
      const holdAId = Number(holdA.id);

      await page.goto(buildOrderUrl(carId, rangeB));
      await expect(
        page.getByText(/already reserved|already booked|already have an active/i)
      ).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Release & rehold this car' }).click({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
        timeout: 15_000,
      });

      await expect.poll(async () => countActiveReservationsForCar(carId)).toBe(1);

      const holdB = await getActiveReservationForCar(carId);
      expect(holdB).toBeTruthy();
      expect(Number(holdB.id)).toBe(holdAId);

      const pickupB = parseSofiaDate(rangeB.pickupDate, rangeB.pickupTime)!;
      const returnB = parseSofiaDate(rangeB.returnDate, rangeB.returnTime)!;
      expect(new Date(holdB.pickup_date).getTime()).toBe(pickupB.getTime());
      expect(new Date(holdB.return_date).getTime()).toBe(returnB.getTime());

      const prior = await withDb(async (client) => {
        const result = await client.query(
          `SELECT status FROM reservations WHERE id = $1`,
          [holdAId]
        );
        return result.rows[0]?.status as string;
      });
      expect(prior).toBe('pending_payment');
    });
  });
});

test.describe("booking-concurrent-hold", () => {
  const CAR_NAME = `E2E Concurrent Hold ${Date.now()}`;

  test.describe('CROSS concurrent hold race (78)', () => {
    test.setTimeout(180_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 120, nights: 3 });

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test('exactly one guest wins the hold; loser cannot book; winner confirms', async ({
      browser,
      request,
    }) => {
      await cleanupReservationsForCar(carId);

      const { winner, loser } = await raceGuestHoldsViaApi(request, carId, range);
      expect(winner.body?.success).toBe(true);
      expect(loser.body?.success).toBe(false);
      expect(loser.body?.error?.code).toBe('CONFLICT');
      expect(await countActiveReservationsForCar(carId)).toBe(1);

      const hold = await getActiveReservationForCar(carId);
      expect(hold).toBeTruthy();

      const winnerContext = await browser.newContext();
      const loserContext = await browser.newContext();
      const winnerPage = await winnerContext.newPage();
      const loserPage = await loserContext.newPage();

      try {
        await applySessionCookies(winnerPage, winner.session);
        // Also set cookies for API origin used by the SPA.
        const pairs = winner.session.cookieHeader
          .split(';')
          .map((p) => p.trim())
          .filter(Boolean)
          .map((pair) => {
            const eq = pair.indexOf('=');
            return {
              name: eq > 0 ? pair.slice(0, eq) : pair,
              value: eq > 0 ? pair.slice(eq + 1) : '',
              url: API_URL,
            };
          });
        if (pairs.length) await winnerContext.addCookies(pairs);

        await winnerPage.goto(buildOrderUrl(carId, range));
        await expect(winnerPage.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
          timeout: 20_000,
        });

        const winnerEmail = uniqueEmail('hold-win');
        await continueToCheckoutAndFillGuest(winnerPage, carId, {
          ...E2E_GUEST,
          email: winnerEmail,
          hotelName: '',
        });
        await winnerPage.getByRole('button', { name: 'Pay with Stripe' }).click();
        await winnerPage.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

        const stripeSessionId =
          new URL(winnerPage.url()).searchParams.get('session_id') || '';
        expect(stripeSessionId).toMatch(/^cs_test_/);

        const reservation = await getReservationByStripeSessionId(stripeSessionId);
        expect(reservation?.status).toBe('processing_payment');

        const webhookEvent = buildCheckoutCompletedEvent({
          eventId: `evt_e2e_concurrent_${Date.now()}`,
          sessionId: stripeSessionId,
          reservationId: reservation.id,
          carId: reservation.car_id,
          sessionIdMeta: reservation.session_id,
          amountTotal: eurosToStripeCents(Number(reservation.total_price)),
        });
        const webhookRes = await postSignedWebhook(request, webhookEvent);
        expect(webhookRes.status()).toBe(200);

        const confirmed = await getReservationByStripeSessionId(stripeSessionId);
        expect(confirmed.status).toBe('confirmed');
        expect(await countOrdersForCar(carId)).toBe(1);
        expect(await countActiveReservationsForCar(carId)).toBe(0);

        await applySessionCookies(loserPage, loser.session);
        await loserPage.goto(buildOrderUrl(carId, range));
        await expect(loserPage.getByRole('heading', { name: 'Review your booking' })).toHaveCount(0, {
          timeout: 15_000,
        });
        await expect(
          loserPage.getByText(/already reserved|different dates|different car/i).first()
        ).toBeVisible({ timeout: 15_000 });

        await fillHomeSearch(loserPage, range);
        await expect(loserPage.getByRole('heading', { name: CAR_NAME })).toHaveCount(0);

        const search = await searchPublicCars(request, {
          pickupDate: range.pickupDate,
          returnDate: range.returnDate,
          pickupTime: range.pickupTime,
          returnTime: range.returnTime,
        });
        expect(search.status).toBe(200);
        expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(false);
      } finally {
        await winnerContext.close();
        await loserContext.close();
      }
    });
  });
});

test.describe("booking-stripe-cancel", () => {
  const CAR_NAME = `E2E Stripe Cancel ${Date.now()}`;

  test.describe('Stripe cancel mid-checkout (86)', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 220, nights: 2 });
    const guestEmail = uniqueEmail('stripe-cancel');

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test('cancel URL releases pending_payment hold and frees search', async ({ page, request }) => {
      await cleanupReservationsForCar(carId);

      await openOrderAndResolveConflict(page, carId, range);
      await continueToCheckoutAndFillGuest(page, carId, {
        ...E2E_GUEST,
        email: guestEmail,
        hotelName: '',
      });

      const hold = await getActiveReservationForCar(carId);
      expect(hold).toBeTruthy();
      expect(hold.status).toBe('pending_payment');
      const reservationId = Number(hold.id);

      // Simulate Stripe back/cancel without completing payment (stub has no cancel_url UI).
      await page.goto('/checkout/cancel');
      await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/hold has been released/i).first()).toBeVisible();

      await assertReservationStatus(reservationId, 'cancelled');
      expect(await countActiveReservationsForCar(carId)).toBe(0);

      const search = await searchPublicCars(request, {
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
      });
      expect(search.status).toBe(200);
      expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(true);

      await fillHomeSearch(page, range);
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
    });
  });
});

test.describe("booking-cancel", () => {
  const CAR_NAME = `E2E Cancel Car ${Date.now()}`;

  test.describe('Booking cancel path', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 85, nights: 3 });
    const guestEmail = uniqueEmail('cancel');

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

    test('guest can cancel checkout and release the hold', async ({ page }) => {
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
      expect(reservation).toBeTruthy();
      expect(reservation.status).toBe('processing_payment');

      await page.goto('/checkout/cancel');
      await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible({
        timeout: 15_000,
      });

      const afterCancel = await getReservationByStripeSessionId(stripeSessionId);
      expect(afterCancel.status).toBe('cancelled');
      expect(await countActiveReservationsForCar(carId)).toBe(0);
    });
  });
});
