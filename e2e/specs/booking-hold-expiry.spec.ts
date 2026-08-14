import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  countActiveReservationsForCar,
  countDateBlocksForCar,
  expireAbandonedHold,
  assertReservationStatus,
  getReservationById,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import { fillHomeSearch } from '../helpers/booking';
import { searchPublicCars } from '../helpers/fleet';

const CAR_NAME = `E2E Hold Expiry ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

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

    await fillHomeSearch(adminPage, range);
    await expect(adminPage.getByRole('heading', { name: CAR_NAME })).toBeVisible({
      timeout: 15_000,
    });
  });
});
