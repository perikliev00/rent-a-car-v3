import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getOrderById,
  getReservationById,
  assertReservationStatus,
  assertDateBlockCovers,
  countDateBlocksForCar,
} from '../helpers/db';
import { allocateFutureRange } from '../helpers/dates';
import { uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import { confirmDeleteDialog, openOrderRowAction } from '../helpers/admin-orders';

const CAR_NAME = `E2E Admin Delete ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-003 Delete/restore keep order–reservation consistency', () => {
  test.setTimeout(120_000);

  let carId: number;

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

  test('delete cancels reservation and restore recreates confirmed link', async ({
    adminPage,
  }) => {
    const email = uniqueEmail('admin-del');
    const range = allocateFutureRange({ fromDaysAhead: 30, nights: 3 });

    const linked = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      guest: { ...E2E_GUEST, email, fullName: 'Delete Restore Guest' },
      totalPrice: 165,
    });

    expect(await countDateBlocksForCar(carId)).toBe(1);
    await assertReservationStatus(linked.reservationId, 'confirmed');

    await adminPage.goto('/admin/orders');
    await adminPage.getByLabel('Search').fill(email);
    await expect(adminPage.getByText(email)).toBeVisible({ timeout: 10_000 });

    confirmDeleteDialog(adminPage);
    await openOrderRowAction(adminPage, email, 'Delete');
    await expect(adminPage.getByText('Order moved to bin')).toBeVisible({ timeout: 15_000 });

    const deletedOrder = await getOrderById(linked.orderId);
    expect(deletedOrder.is_deleted).toBe(true);
    await assertReservationStatus(linked.reservationId, 'cancelled');
    expect(await countDateBlocksForCar(carId)).toBe(0);

    await adminPage.getByRole('button', { name: 'Deleted' }).click();
    await expect(adminPage.getByText(email)).toBeVisible({ timeout: 10_000 });
    await openOrderRowAction(adminPage, email, 'Restore');
    await expect(adminPage.getByText('Order restored')).toBeVisible({ timeout: 15_000 });

    const restored = await getOrderById(linked.orderId);
    expect(restored.is_deleted).toBe(false);
    expect(restored.status).toBe('active');
    expect(restored.reservation_id).toBeTruthy();

    const newReservationId = Number(restored.reservation_id);
    await assertReservationStatus(newReservationId, 'confirmed');
    expect(await countDateBlocksForCar(carId)).toBe(1);
    await assertDateBlockCovers(carId, range.pickupDate, range.returnDate);

    const reservation = await getReservationById(newReservationId);
    expect(reservation.email).toBe(email);
    // Original cancelled reservation may differ from newly linked id
    if (newReservationId === linked.reservationId) {
      expect(reservation.status).toBe('confirmed');
    } else {
      await assertReservationStatus(linked.reservationId, 'cancelled');
    }
  });
});
