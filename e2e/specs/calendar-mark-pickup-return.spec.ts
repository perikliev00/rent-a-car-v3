import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
  assertStatusHistoryContains,
  getCarStatus,
} from '../helpers/db';
import { uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import {
  getSofiaIsoDateString,
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
  parseSofiaDate,
} from '../helpers/dates';
import { openCalendarWeek, calendarEventTestId } from '../helpers/calendar';

const CAR_NAME = `E2E Cal Mark PU ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Calendar Mark pickup / Mark return (94)', () => {
  test.setTimeout(180_000);

  let carId: number;
  const today = getSofiaIsoDateString();
  const returnDate = formatSofiaIsoDateFromParts(
    addSofiaCalendarDays(parseSofiaDate(today, '00:00') ?? new Date(), 2)
  );
  const guestEmail = uniqueEmail('cal-mark');
  const guestName = `Mark PU Guest ${Date.now()}`;

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

  test('Event details Mark pickup then Mark return updates status and fleet', async ({
    adminPage,
  }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'car_prepared',
      withBlock: true,
      pickupDate: today,
      returnDate,
      pickupTime: '10:00',
      returnTime: '10:00',
      guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
    });

    await openCalendarWeek(adminPage, today);
    await adminPage.getByTestId(calendarEventTestId(seeded.reservationId)).click();
    await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
      timeout: 10_000,
    });

    await adminPage.getByTestId('mark-pickup').click();
    await expect(adminPage.getByText('Marked picked up')).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => {
        try {
          await assertReservationStatus(seeded.reservationId, 'picked_up');
          return true;
        } catch {
          return false;
        }
      }, { timeout: 15_000 })
      .toBe(true);
    await assertStatusHistoryContains(seeded.reservationId, 'picked_up');
    expect(await getCarStatus(carId)).toBe('rented');

    // markStatus closes the drawer — reopen for Mark return
    await openCalendarWeek(adminPage, today);
    await adminPage.getByTestId(calendarEventTestId(seeded.reservationId)).click();
    await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
      timeout: 10_000,
    });
    await adminPage.getByTestId('mark-return').click();
    await expect(adminPage.getByText('Marked returned')).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => {
        try {
          await assertReservationStatus(seeded.reservationId, 'returned');
          return true;
        } catch {
          return false;
        }
      }, { timeout: 15_000 })
      .toBe(true);
    await assertStatusHistoryContains(seeded.reservationId, 'returned');
    expect(await getCarStatus(carId)).toBe('needs_cleaning');
  });
});
