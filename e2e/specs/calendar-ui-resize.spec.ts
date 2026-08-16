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
import {
  openCalendarWeek,
  resizeCalendarEventEnd,
  calendarEventTestId,
} from '../helpers/calendar';

const CAR_NAME = `E2E Cal UI Resize ${Date.now()}`;

/** Tuesday pickup so a 2-night stay sits mid-week with room to drag the end handle. */
function allocateTuesdayStay(fromDaysAhead: number, nights: number) {
  const base = allocateFutureRange({ fromDaysAhead, nights });
  let pickup = base.pickupDate;
  for (let i = 0; i < 7; i += 1) {
    const at = parseSofiaDate(pickup, '12:00');
    const weekday = at
      ? new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Sofia', weekday: 'short' }).format(at)
      : '';
    if (weekday === 'Tue') break;
    pickup = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate(pickup, '00:00') ?? new Date(), 1)
    );
  }
  const returnDate = formatSofiaIsoDateFromParts(
    addSofiaCalendarDays(parseSofiaDate(pickup, '00:00') ?? new Date(), nights)
  );
  return { ...base, pickupDate: pickup, returnDate };
}

test.describe.configure({ mode: 'serial' });

test.describe('Calendar UI resize (85)', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateTuesdayStay(210, 2);
  const guestName = `Cal UI Resize ${Date.now()}`;
  const guestEmail = uniqueEmail('cal-ui-resize');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('resize end lengthens then shortens with price and block updates', async ({ adminPage }) => {
    await cleanupReservationsForCar(carId);
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      dayPrice: 55,
      guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
    });

    const before = await getReservationById(seeded.reservationId);
    const totalBefore = Number(before.total_price);

    await openCalendarWeek(adminPage, range.pickupDate);
    await expect(adminPage.getByTestId(calendarEventTestId(seeded.reservationId))).toBeVisible({
      timeout: 15_000,
    });

    await resizeCalendarEventEnd(adminPage, seeded.reservationId, 160);
    await expect
      .poll(async () => {
        const row = await getReservationById(seeded.reservationId);
        return Number(row.total_price);
      }, { timeout: 15_000 })
      .toBeGreaterThan(totalBefore);
    await expect(adminPage.getByText('Reservation resized')).toBeVisible({ timeout: 5_000 }).catch(
      () => undefined
    );

    const longer = await getReservationById(seeded.reservationId);
    const longerReturn = getSofiaIsoDateString(new Date(longer.return_date));
    expect(longerReturn).not.toBe(range.returnDate);
    expect(Number(longer.total_price)).toBeGreaterThan(totalBefore);
    await assertDateBlockCovers(carId, range.pickupDate, longerReturn);

    await resizeCalendarEventEnd(adminPage, seeded.reservationId, -120);
    await expect
      .poll(async () => {
        const row = await getReservationById(seeded.reservationId);
        return Number(row.total_price);
      }, { timeout: 15_000 })
      .toBeLessThan(Number(longer.total_price));
    await expect(adminPage.getByText('Reservation resized').last()).toBeVisible({
      timeout: 5_000,
    }).catch(() => undefined);

    const shorter = await getReservationById(seeded.reservationId);
    const shorterReturn = getSofiaIsoDateString(new Date(shorter.return_date));
    await assertDateBlockCovers(carId, range.pickupDate, shorterReturn);
  });
});
