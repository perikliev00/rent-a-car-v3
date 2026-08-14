import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
  countDateBlocksForCar,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { buildSearchQuery } from '../helpers/booking';
import { openCalendarWeek } from '../helpers/calendar';

const CAR_NAME = `E2E Cal Cancel ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-019 Calendar cancel reservation', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 52, nights: 3 });
  const guestName = `Cal Cancel Guest ${Date.now()}`;
  const guestEmail = uniqueEmail('cal-cancel');

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

  test('cancel from event drawer frees block and restores search', async ({
    adminPage,
    page,
  }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
    });

    expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(1);

    await openCalendarWeek(adminPage, range.pickupDate);
    await adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first().click();
    await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
      timeout: 10_000,
    });

    adminPage.once('dialog', (d) => d.accept());
    await adminPage.getByTestId('cancel-reservation').click();
    await expect(adminPage.getByText('Reservation cancelled')).toBeVisible({ timeout: 15_000 });

    await assertReservationStatus(seeded.reservationId, 'cancelled');
    expect(await countDateBlocksForCar(carId)).toBe(0);

    await page.goto(`/search?${buildSearchQuery(range)}`);
    await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
  });
});
