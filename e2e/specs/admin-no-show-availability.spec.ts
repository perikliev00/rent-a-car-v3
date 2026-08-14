import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
  assertStatusHistoryContains,
  countDateBlocksForCar,
  getCarStatus,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { applyOpsStatus } from '../helpers/admin-reservations';
import { buildSearchQuery } from '../helpers/booking';

const CAR_NAME = `E2E NoShow Avail ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-021 No-show frees remaining availability', () => {
  test.setTimeout(120_000);

  let carId: number;
  // Future range avoids "pickup must be later than now" search validation.
  const range = allocateFutureRange({ fromDaysAhead: 2, nights: 4 });
  const guestEmail = uniqueEmail('no-show');

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

  test('no_show clears date blocks and frees the car for search', async ({
    adminPage,
    page,
    request,
  }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      guest: { ...E2E_GUEST, email: guestEmail, fullName: 'No Show Guest' },
    });
    const reservationId = seeded.reservationId;

    expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(1);

    // Future confirmed bookings are not in Today's widgets — Apply falls back to admin API.
    await applyOpsStatus(adminPage, reservationId, 'no_show', { request });
    await assertReservationStatus(reservationId, 'no_show');
    await assertStatusHistoryContains(reservationId, 'no_show');

    expect(await countDateBlocksForCar(carId)).toBe(0);

    const carStatus = await getCarStatus(carId);
    expect(carStatus).not.toBe('reserved');

    await page.goto(`/search?${buildSearchQuery(range)}`);
    await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
  });
});
