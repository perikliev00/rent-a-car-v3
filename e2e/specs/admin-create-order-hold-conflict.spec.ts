import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getActiveReservationForCar,
  getOrderByGuestEmail,
  assertReservationStatus,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { fillCreateOrderForm } from '../helpers/admin-orders';

const CAR_NAME = `E2E Admin Hold Conflict ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Admin create order vs guest hold (98)', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 70, nights: 2 });
  const guestEmail = uniqueEmail('hold-conflict');
  const adminEmail = uniqueEmail('admin-order-conflict');

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

  test('create order conflicts with active hold; guest keeps hold', async ({ adminPage }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'pending_payment',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Hold Guest' },
    });

    await adminPage.goto('/admin/orders');
    await expect(adminPage.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await adminPage.getByRole('link', { name: 'Create order' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Create order' })).toBeVisible();

    await fillCreateOrderForm(adminPage, {
      carName: CAR_NAME,
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      email: adminEmail,
      fullName: 'Admin Conflict Guest',
      hotelName: E2E_GUEST.hotelName,
    });

    await adminPage.getByRole('button', { name: 'Create' }).click();
    await expect(
      adminPage.getByText(/active online reservation|choose different dates|hold expires/i)
    ).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('button', { name: /force/i })).toHaveCount(0);

    await assertReservationStatus(seeded.reservationId, 'pending_payment');
    expect(await getActiveReservationForCar(carId)).toBeTruthy();
    expect(await getOrderByGuestEmail(adminEmail)).toBeFalsy();
  });
});
