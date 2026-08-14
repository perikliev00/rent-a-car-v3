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
import { getSofiaIsoDateString } from '../helpers/dates';
import {
  openCalendarWeek,
  resizeCalendarEventEnd,
  calendarEventTestId,
} from '../helpers/calendar';

const CAR_NAME = `E2E Cal UI Resize ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Calendar UI resize (85)', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 210, nights: 3 });
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
    await expect(adminPage.getByText('Reservation resized')).toBeVisible({ timeout: 15_000 });

    const longer = await getReservationById(seeded.reservationId);
    const longerReturn = getSofiaIsoDateString(new Date(longer.return_date));
    expect(longerReturn).not.toBe(range.returnDate);
    expect(Number(longer.total_price)).toBeGreaterThan(totalBefore);
    await assertDateBlockCovers(carId, range.pickupDate, longerReturn);

    await resizeCalendarEventEnd(adminPage, seeded.reservationId, -120);
    await expect(adminPage.getByText('Reservation resized').last()).toBeVisible({
      timeout: 15_000,
    });

    const shorter = await getReservationById(seeded.reservationId);
    const shorterReturn = getSofiaIsoDateString(new Date(shorter.return_date));
    expect(Number(shorter.total_price)).toBeLessThan(Number(longer.total_price));
    await assertDateBlockCovers(carId, range.pickupDate, shorterReturn);
  });
});
