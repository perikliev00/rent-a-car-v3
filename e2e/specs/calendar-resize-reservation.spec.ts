import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertDateBlockCovers,
  getReservationById,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import {
  getSofiaIsoDateString,
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
  parseSofiaDate,
} from '../helpers/dates';
import { resizeCalendarEventViaApi, toSofiaIso } from '../helpers/calendar';

const CAR_NAME = `E2E Cal Resize ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-008 Calendar resize reservation (API)', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 75, nights: 3 });
  const guestEmail = uniqueEmail('cal-resize');

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

  test('API resize extends return date and increases total price', async ({ request }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      dayPrice: 55,
      guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Cal Resize Guest' },
    });

    const before = await getReservationById(seeded.reservationId);
    const totalBefore = Number(before.total_price);

    const longerReturn = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate(range.returnDate, '00:00') ?? new Date(), 2)
    );
    const start = toSofiaIso(range.pickupDate, range.pickupTime);
    const end = toSofiaIso(longerReturn, range.returnTime);

    const result = await resizeCalendarEventViaApi(request, seeded.reservationId, {
      start,
      end,
      carId,
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.ok).toBeTruthy();

    const after = await getReservationById(seeded.reservationId);
    expect(getSofiaIsoDateString(new Date(after.pickup_date))).toBe(range.pickupDate);
    expect(getSofiaIsoDateString(new Date(after.return_date))).toBe(longerReturn);
    expect(Number(after.total_price)).toBeGreaterThan(totalBefore);
    const snapshotTotal = Number(
      (after.price_snapshot as { totalPrice?: number } | null)?.totalPrice ?? 0
    );
    expect(snapshotTotal).toBe(Number(after.total_price));
    expect(snapshotTotal).toBeGreaterThan(totalBefore);

    await assertDateBlockCovers(carId, range.pickupDate, longerReturn);
  });

  test('API resize shorter stay decreases total price', async ({ request }) => {
    const longRange = allocateFutureRange({ fromDaysAhead: 85, nights: 5 });
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate: longRange.pickupDate,
      returnDate: longRange.returnDate,
      pickupTime: longRange.pickupTime,
      returnTime: longRange.returnTime,
      dayPrice: 55,
      guest: { ...E2E_GUEST, email: uniqueEmail('cal-resize-short'), fullName: 'Cal Resize Short' },
    });

    const before = await getReservationById(seeded.reservationId);
    const totalBefore = Number(before.total_price);

    const shorterReturn = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate(longRange.pickupDate, '00:00') ?? new Date(), 2)
    );
    const result = await resizeCalendarEventViaApi(request, seeded.reservationId, {
      start: toSofiaIso(longRange.pickupDate, longRange.pickupTime),
      end: toSofiaIso(shorterReturn, longRange.returnTime),
      carId,
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);

    const after = await getReservationById(seeded.reservationId);
    expect(getSofiaIsoDateString(new Date(after.return_date))).toBe(shorterReturn);
    expect(Number(after.total_price)).toBeLessThan(totalBefore);
    await assertDateBlockCovers(carId, longRange.pickupDate, shorterReturn);
  });
});
