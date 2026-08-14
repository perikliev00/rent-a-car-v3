import { test, expect } from '../fixtures/base';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getOrderByGuestEmail,
  getReservationById,
  assertOrderLinkedToReservation,
  assertReservationStatus,
  assertStatusHistoryContains,
  assertDateBlockCovers,
  assertPriceSnapshotBasics,
  countDateBlocksForCar,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import { fillCreateOrderForm, openOrderRowAction } from '../helpers/admin-orders';

const CAR_NAME = `E2E Admin Create ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-001 Admin creates full manual reservation', () => {
  test.setTimeout(120_000);

  let carId: number;
  const guestEmail = uniqueEmail('admin-create');
  const range = allocateFutureRange({ fromDaysAhead: 20, nights: 3 });

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

  test('owner creates order and sees it in detail, ops, and calendar', async ({ adminPage }) => {
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
      email: guestEmail,
      fullName: 'Admin Create Guest',
      hotelName: E2E_GUEST.hotelName,
    });

    await adminPage.getByRole('button', { name: 'Create' }).click();
    await expect(adminPage.getByText('Order created')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage).toHaveURL(/\/admin\/orders\/?$/);

    await adminPage.getByLabel('Search').fill(guestEmail);
    await expect(adminPage.getByText(guestEmail)).toBeVisible({ timeout: 10_000 });
    await openOrderRowAction(adminPage, guestEmail, 'View');

    const order = await getOrderByGuestEmail(guestEmail);
    expect(order).toBeTruthy();
    expect(order.status).toBe('active');
    expect(order.reservation_id).toBeTruthy();

    await expect(
      adminPage.getByRole('heading', { name: `Order #${order.id}` })
    ).toBeVisible();
    await expect(adminPage.getByText(guestEmail)).toBeVisible();
    await expect(adminPage.getByText(range.pickupDate)).toBeVisible();
    await expect(adminPage.getByText(range.returnDate)).toBeVisible();
    await expect(adminPage.getByText('€165.00').first()).toBeVisible();

    const reservationId = Number(order.reservation_id);
    await assertOrderLinkedToReservation(Number(order.id), reservationId);
    await assertReservationStatus(reservationId, 'confirmed');
    await assertStatusHistoryContains(reservationId, 'confirmed');
    await assertPriceSnapshotBasics(reservationId);
    expect(await countDateBlocksForCar(carId)).toBe(1);
    await assertDateBlockCovers(carId, range.pickupDate, range.returnDate);

    const reservation = await getReservationById(reservationId);
    expect(reservation.email).toBe(guestEmail);

    await adminPage.goto(`/admin/reservations?id=${reservationId}`);
    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible();
    await expect(adminPage.getByText(`Reservation #${reservationId}`)).toBeVisible();
    await expect(adminPage.getByText(/confirmed/i).first()).toBeVisible();

    await adminPage.goto(`/admin/calendar?date=${range.pickupDate}&view=week`);
    await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible({ timeout: 20_000 });
    await expect(
      adminPage.getByText(/Admin Create Guest|Create Guest/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });
});
