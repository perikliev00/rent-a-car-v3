import { expect, test } from '../fixtures/base';
import { confirmDeleteDialog, fillCreateOrderForm, fillEditOrderDates, openOrderRowAction } from '../helpers/admin-orders';
import {
  addSofiaCalendarDays,
  allocateFutureRange,
  formatSofiaIsoDateFromParts,
  parseSofiaDate,
} from '../helpers/dates';
import {
  assertDateBlockCovers,
  assertOrderLinkedToReservation,
  assertPriceSnapshotBasics,
  assertReservationStatus,
  assertStatusHistoryContains,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  countDateBlocksForCar,
  getActiveReservationForCar,
  getOrderByGuestEmail,
  getOrderById,
  getReservationById,
} from '../helpers/db';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { E2E_GUEST, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("admin-create-order", () => {
  const CAR_NAME = `E2E Admin Create ${Date.now()}`;
  
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
});

test.describe("admin-create-order-hold-conflict", () => {
  const CAR_NAME = `E2E Admin Hold Conflict ${Date.now()}`;

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
});

test.describe("admin-edit-order-sync", () => {
  const CAR_NAME = `E2E Admin Edit ${Date.now()}`;
  
  test.describe('ADMIN-002 Edit order syncs reservation + calendar', () => {
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
  
    test('success path updates order, reservation, block, and price together', async ({
      adminPage,
    }) => {
      const email = uniqueEmail('admin-edit-ok');
      const range = allocateFutureRange({ fromDaysAhead: 25, nights: 3 });
      const newReturnDate = formatSofiaIsoDateFromParts(
        addSofiaCalendarDays(parseSofiaDate(range.pickupDate, '00:00')!, 5)
      );
  
      const linked = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        guest: { ...E2E_GUEST, email, fullName: 'Edit Sync Guest' },
        totalPrice: 165,
        dayPrice: 55,
      });
  
      const beforeOrder = await getOrderById(linked.orderId);
      const beforeRes = await getReservationById(linked.reservationId);
      expect(Number(beforeOrder.total_price)).toBe(165);
  
      await adminPage.goto('/admin/orders');
      await adminPage.getByLabel('Search').fill(email);
      await expect(adminPage.getByText(email)).toBeVisible({ timeout: 10_000 });
      await openOrderRowAction(adminPage, email, 'Edit');
      await expect(
        adminPage.getByRole('heading', { name: `Edit order #${linked.orderId}` })
      ).toBeVisible();
  
      await fillEditOrderDates(adminPage, {
        returnDate: newReturnDate,
        pickupLocationLabel: 'Sunny Beach',
      });
      await adminPage.getByRole('button', { name: 'Save' }).click();
      await expect(adminPage.getByText('Order updated')).toBeVisible({ timeout: 15_000 });
      await expect(adminPage).toHaveURL(new RegExp(`/admin/orders/${linked.orderId}`));
  
      const afterOrder = await getOrderById(linked.orderId);
      const afterRes = await getReservationById(linked.reservationId);
  
      expect(String(afterOrder.return_date).slice(0, 10)).not.toBe(
        String(beforeOrder.return_date).slice(0, 10)
      );
      expect(Number(afterOrder.total_price)).not.toBe(Number(beforeOrder.total_price));
      expect(String(afterRes.return_date).slice(0, 10)).toBe(
        String(afterOrder.return_date).slice(0, 10)
      );
      expect(Number(afterRes.total_price)).toBe(Number(afterOrder.total_price));
      expect(afterRes.pickup_location).toBe(afterOrder.pickup_location || afterRes.pickup_location);
      await assertOrderLinkedToReservation(linked.orderId, linked.reservationId);
      await assertReservationStatus(linked.reservationId, 'confirmed');
      await assertDateBlockCovers(carId, range.pickupDate, newReturnDate);
      expect(await countDateBlocksForCar(carId)).toBe(1);
  
      // Snapshot object should move with price recalculation
      expect(beforeRes.price_snapshot?.totalPrice).toBe(165);
      expect(afterRes.price_snapshot?.totalPrice).toBe(Number(afterOrder.total_price));
    });
  
    test('conflict path leaves order, reservation, and block unchanged', async ({ adminPage }) => {
      const emailA = uniqueEmail('admin-edit-a');
      const emailB = uniqueEmail('admin-edit-b');
      const rangeA = allocateFutureRange({ fromDaysAhead: 40, nights: 2 });
      const rangeB = allocateFutureRange({ fromDaysAhead: 43, nights: 2 });
  
      const linkedA = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        pickupDate: rangeA.pickupDate,
        returnDate: rangeA.returnDate,
        guest: { ...E2E_GUEST, email: emailA, fullName: 'Conflict Order A' },
        totalPrice: 110,
      });
  
      await seedLinkedBooking({
        carId,
        status: 'confirmed',
        pickupDate: rangeB.pickupDate,
        returnDate: rangeB.returnDate,
        guest: { ...E2E_GUEST, email: emailB, fullName: 'Conflict Order B' },
        totalPrice: 110,
      });
  
      const beforeOrder = await getOrderById(linkedA.orderId);
      const beforeRes = await getReservationById(linkedA.reservationId);
      const beforeBlocks = await countDateBlocksForCar(carId);
  
      await adminPage.goto(`/admin/orders/${linkedA.orderId}/edit`);
      await expect(
        adminPage.getByRole('heading', { name: `Edit order #${linkedA.orderId}` })
      ).toBeVisible();
  
      // Move A onto B's exact window to force a booking-block overlap.
      await fillEditOrderDates(adminPage, {
        pickupDate: rangeB.pickupDate,
        returnDate: rangeB.returnDate,
      });
      await adminPage.getByRole('button', { name: 'Save' }).click();
  
      await expect(
        adminPage.getByText(/already booked|Booking overlaps|different dates|active online reservation/i)
      ).toBeVisible({ timeout: 8_000 });
      await expect(adminPage).toHaveURL(new RegExp(`/admin/orders/${linkedA.orderId}/edit`));
  
      const afterOrder = await getOrderById(linkedA.orderId);
      const afterRes = await getReservationById(linkedA.reservationId);
      expect(String(afterOrder.return_date)).toBe(String(beforeOrder.return_date));
      expect(Number(afterOrder.total_price)).toBe(Number(beforeOrder.total_price));
      expect(String(afterRes.return_date)).toBe(String(beforeRes.return_date));
      expect(Number(afterRes.total_price)).toBe(Number(beforeRes.total_price));
      expect(await countDateBlocksForCar(carId)).toBe(beforeBlocks);
      await assertDateBlockCovers(carId, rangeA.pickupDate, rangeA.returnDate);
    });
  });
});

test.describe("admin-delete-restore-order", () => {
  const CAR_NAME = `E2E Admin Delete ${Date.now()}`;
  
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
});
