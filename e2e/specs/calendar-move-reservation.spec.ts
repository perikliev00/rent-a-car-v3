import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertDateBlockCovers,
  getReservationById,
  getOrderById,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { getSofiaIsoDateString } from '../helpers/dates';
import { openCalendarWeek, moveCalendarEventViaApi, rangeToIso } from '../helpers/calendar';

const CAR_NAME = `E2E Cal Move ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-007 Calendar move reservation (API)', () => {
  test.setTimeout(120_000);

  let carId: number;
  const original = allocateFutureRange({ fromDaysAhead: 60, nights: 3 });
  const moved = allocateFutureRange({ fromDaysAhead: 70, nights: 3 });
  const guestName = `Cal Move Guest ${Date.now()}`;
  const guestEmail = uniqueEmail('cal-move');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId);
    await cleanupTestCar(carId);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('API move updates reservation, order, and date block', async ({ adminPage, request }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate: original.pickupDate,
      returnDate: original.returnDate,
      pickupTime: original.pickupTime,
      returnTime: original.returnTime,
      guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
    });

    const { start, end } = rangeToIso(moved);
    const result = await moveCalendarEventViaApi(request, seeded.reservationId, {
      start,
      end,
      carId,
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.ok).toBeTruthy();

    const reservation = await getReservationById(seeded.reservationId);
    expect(reservation).toBeTruthy();
    expect(getSofiaIsoDateString(new Date(reservation.pickup_date))).toBe(moved.pickupDate);
    expect(getSofiaIsoDateString(new Date(reservation.return_date))).toBe(moved.returnDate);

    if (seeded.orderId) {
      const order = await getOrderById(seeded.orderId);
      expect(order).toBeTruthy();
      expect(getSofiaIsoDateString(new Date(order.pickup_date))).toBe(moved.pickupDate);
      expect(getSofiaIsoDateString(new Date(order.return_date))).toBe(moved.returnDate);
      expect(Number(order.total_price)).toBe(Number(reservation.total_price));
    }

    await assertDateBlockCovers(carId, moved.pickupDate, moved.returnDate);

    await openCalendarWeek(adminPage, moved.pickupDate);
    await expect(
      adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first()
    ).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first().click();
    await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
