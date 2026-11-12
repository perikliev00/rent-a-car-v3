// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/admin-orders'.
import { confirmDeleteDialog, fillCreateOrderForm, fillEditOrderDates, openOrderRowAction } from '../helpers/admin-orders';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  addSofiaCalendarDays,
  // Contribute this line to the enclosing declaration or statement.
  allocateFutureRange,
  // Contribute this line to the enclosing declaration or statement.
  formatSofiaIsoDateFromParts,
  // Contribute this line to the enclosing declaration or statement.
  parseSofiaDate,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/dates';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  assertDateBlockCovers,
  // Contribute this line to the enclosing declaration or statement.
  assertOrderLinkedToReservation,
  // Contribute this line to the enclosing declaration or statement.
  assertPriceSnapshotBasics,
  // Contribute this line to the enclosing declaration or statement.
  assertReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  assertStatusHistoryContains,
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  countDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  getActiveReservationForCar,
  // Contribute this line to the enclosing declaration or statement.
  getOrderByGuestEmail,
  // Contribute this line to the enclosing declaration or statement.
  getOrderById,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { E2E_GUEST, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("admin-create-order", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Admin Create ${Date.now()}`;
  
  // Call test.describe to perform this step.
  test.describe('ADMIN-001 Admin creates full manual reservation', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);
  
    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the guest email constant.
    const guestEmail = uniqueEmail('admin-create');
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 20, nights: 3 });
  
    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });
  
    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });
  
    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });
  
    // Define a single test case and its expectations.
    test('owner creates order and sees it in detail, ops, and calendar', async ({ adminPage }) => {
      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/orders');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Orders' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('link', { name: 'Create order' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Create order' })).toBeVisible();
  
      // Wait until the asynchronous operation resolves.
      await fillCreateOrderForm(adminPage, {
        // Provide the car name field value.
        carName: CAR_NAME,
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the email field value.
        email: guestEmail,
        // Provide the full name field value.
        fullName: 'Admin Create Guest',
        // Provide the hotel name field value.
        hotelName: E2E_GUEST.hotelName,
      });
  
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Create' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Order created')).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage).toHaveURL(/\/admin\/orders\/?$/);
  
      // Wait until the asynchronous operation resolves.
      await adminPage.getByLabel('Search').fill(guestEmail);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(guestEmail)).toBeVisible({ timeout: 10_000 });
      // Wait until the asynchronous operation resolves.
      await openOrderRowAction(adminPage, guestEmail, 'View');
  
      // Create the order constant.
      const order = await getOrderByGuestEmail(guestEmail);
      // Assert that the value matches the intended expectation.
      expect(order).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(order.status).toBe('active');
      // Assert that the value matches the intended expectation.
      expect(order.reservation_id).toBeTruthy();
  
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByRole to perform this step.
        adminPage.getByRole('heading', { name: `Order #${order.id}` })
      // Continue the surrounding logic with this statement.
      ).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(guestEmail)).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(range.pickupDate)).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(range.returnDate)).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('€165.00').first()).toBeVisible();
  
      // Create the reservation id constant.
      const reservationId = Number(order.reservation_id);
      // Wait until the asynchronous operation resolves.
      await assertOrderLinkedToReservation(Number(order.id), reservationId);
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(reservationId, 'confirmed');
      // Wait until the asynchronous operation resolves.
      await assertStatusHistoryContains(reservationId, 'confirmed');
      // Wait until the asynchronous operation resolves.
      await assertPriceSnapshotBasics(reservationId);
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(1);
      // Wait until the asynchronous operation resolves.
      await assertDateBlockCovers(carId, range.pickupDate, range.returnDate);
  
      // Create the reservation constant.
      const reservation = await getReservationById(reservationId);
      // Assert that the value matches the intended expectation.
      expect(reservation.email).toBe(guestEmail);
  
      // Wait until the asynchronous operation resolves.
      await adminPage.goto(`/admin/reservations?id=${reservationId}`);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(`Reservation #${reservationId}`)).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(/confirmed/i).first()).toBeVisible();
  
      // Wait until the asynchronous operation resolves.
      await adminPage.goto(`/admin/calendar?date=${range.pickupDate}&view=week`);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible({ timeout: 20_000 });
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByText to perform this step.
        adminPage.getByText(/Admin Create Guest|Create Guest/i).first()
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 20_000 });
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-create-order-hold-conflict", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Admin Hold Conflict ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Admin create order vs guest hold (98)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 70, nights: 2 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('hold-conflict');
    // Create the admin email constant.
    const adminEmail = uniqueEmail('admin-order-conflict');

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId).catch(() => undefined);
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId).catch(() => undefined);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('create order conflicts with active hold; guest keeps hold', async ({ adminPage }) => {
      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'pending_payment',
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Hold Guest' },
      });

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/orders');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Orders' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('link', { name: 'Create order' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Create order' })).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await fillCreateOrderForm(adminPage, {
        // Provide the car name field value.
        carName: CAR_NAME,
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the email field value.
        email: adminEmail,
        // Provide the full name field value.
        fullName: 'Admin Conflict Guest',
        // Provide the hotel name field value.
        hotelName: E2E_GUEST.hotelName,
      });

      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Create' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByText to perform this step.
        adminPage.getByText(/active online reservation|choose different dates|hold expires/i)
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('button', { name: /force/i })).toHaveCount(0);

      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(seeded.reservationId, 'pending_payment');
      // Assert that the value matches the intended expectation.
      expect(await getActiveReservationForCar(carId)).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(await getOrderByGuestEmail(adminEmail)).toBeFalsy();
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-edit-order-sync", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Admin Edit ${Date.now()}`;
  
  // Call test.describe to perform this step.
  test.describe('ADMIN-002 Edit order syncs reservation + calendar', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);
  
    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
  
    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });
  
    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });
  
    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });
  
    // Define a single test case and its expectations.
    test('success path updates order, reservation, block, and price together', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the email constant.
      const email = uniqueEmail('admin-edit-ok');
      // Create the range constant.
      const range = allocateFutureRange({ fromDaysAhead: 25, nights: 3 });
      // Create the new return date constant.
      const newReturnDate = formatSofiaIsoDateFromParts(
        // Call addSofiaCalendarDays to perform this step.
        addSofiaCalendarDays(parseSofiaDate(range.pickupDate, '00:00')!, 5)
      );
  
      // Create the linked constant.
      const linked = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email, fullName: 'Edit Sync Guest' },
        // Provide the total price field value.
        totalPrice: 165,
        // Provide the day price field value.
        dayPrice: 55,
      });
  
      // Create the before order constant.
      const beforeOrder = await getOrderById(linked.orderId);
      // Create the before res constant.
      const beforeRes = await getReservationById(linked.reservationId);
      // Assert that the value matches the intended expectation.
      expect(Number(beforeOrder.total_price)).toBe(165);
  
      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/orders');
      // Wait until the asynchronous operation resolves.
      await adminPage.getByLabel('Search').fill(email);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(email)).toBeVisible({ timeout: 10_000 });
      // Wait until the asynchronous operation resolves.
      await openOrderRowAction(adminPage, email, 'Edit');
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByRole to perform this step.
        adminPage.getByRole('heading', { name: `Edit order #${linked.orderId}` })
      // Continue the surrounding logic with this statement.
      ).toBeVisible();
  
      // Wait until the asynchronous operation resolves.
      await fillEditOrderDates(adminPage, {
        // Provide the return date field value.
        returnDate: newReturnDate,
        // Provide the pickup location label field value.
        pickupLocationLabel: 'Sunny Beach',
      });
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Save' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Order updated')).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage).toHaveURL(new RegExp(`/admin/orders/${linked.orderId}`));
  
      // Create the after order constant.
      const afterOrder = await getOrderById(linked.orderId);
      // Create the after res constant.
      const afterRes = await getReservationById(linked.reservationId);
  
      // Assert that the value matches the intended expectation.
      expect(String(afterOrder.return_date).slice(0, 10)).not.toBe(
        // Call String to perform this step.
        String(beforeOrder.return_date).slice(0, 10)
      );
      // Assert that the value matches the intended expectation.
      expect(Number(afterOrder.total_price)).not.toBe(Number(beforeOrder.total_price));
      // Assert that the value matches the intended expectation.
      expect(String(afterRes.return_date).slice(0, 10)).toBe(
        // Call String to perform this step.
        String(afterOrder.return_date).slice(0, 10)
      );
      // Assert that the value matches the intended expectation.
      expect(Number(afterRes.total_price)).toBe(Number(afterOrder.total_price));
      // Assert that the value matches the intended expectation.
      expect(afterRes.pickup_location).toBe(afterOrder.pickup_location || afterRes.pickup_location);
      // Wait until the asynchronous operation resolves.
      await assertOrderLinkedToReservation(linked.orderId, linked.reservationId);
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(linked.reservationId, 'confirmed');
      // Wait until the asynchronous operation resolves.
      await assertDateBlockCovers(carId, range.pickupDate, newReturnDate);
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(1);
  
      // Snapshot object should move with price recalculation
      expect(beforeRes.price_snapshot?.totalPrice).toBe(165);
      // Assert that the value matches the intended expectation.
      expect(afterRes.price_snapshot?.totalPrice).toBe(Number(afterOrder.total_price));
    });
  
    // Define a single test case and its expectations.
    test('conflict path leaves order, reservation, and block unchanged', async ({ adminPage }) => {
      // Create the email a constant.
      const emailA = uniqueEmail('admin-edit-a');
      // Create the email b constant.
      const emailB = uniqueEmail('admin-edit-b');
      // Create the range a constant.
      const rangeA = allocateFutureRange({ fromDaysAhead: 40, nights: 2 });
      // Create the range b constant.
      const rangeB = allocateFutureRange({ fromDaysAhead: 43, nights: 2 });
  
      // Create the linked a constant.
      const linkedA = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the pickup date field value.
        pickupDate: rangeA.pickupDate,
        // Provide the return date field value.
        returnDate: rangeA.returnDate,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: emailA, fullName: 'Conflict Order A' },
        // Provide the total price field value.
        totalPrice: 110,
      });
  
      // Wait until the asynchronous operation resolves.
      await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the pickup date field value.
        pickupDate: rangeB.pickupDate,
        // Provide the return date field value.
        returnDate: rangeB.returnDate,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: emailB, fullName: 'Conflict Order B' },
        // Provide the total price field value.
        totalPrice: 110,
      });
  
      // Create the before order constant.
      const beforeOrder = await getOrderById(linkedA.orderId);
      // Create the before res constant.
      const beforeRes = await getReservationById(linkedA.reservationId);
      // Create the before blocks constant.
      const beforeBlocks = await countDateBlocksForCar(carId);
  
      // Wait until the asynchronous operation resolves.
      await adminPage.goto(`/admin/orders/${linkedA.orderId}/edit`);
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByRole to perform this step.
        adminPage.getByRole('heading', { name: `Edit order #${linkedA.orderId}` })
      // Continue the surrounding logic with this statement.
      ).toBeVisible();
  
      // Move A onto B's exact window to force a booking-block overlap.
      await fillEditOrderDates(adminPage, {
        // Provide the pickup date field value.
        pickupDate: rangeB.pickupDate,
        // Provide the return date field value.
        returnDate: rangeB.returnDate,
      });
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Save' }).click();
  
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByText to perform this step.
        adminPage.getByText(/already booked|Booking overlaps|different dates|active online reservation/i)
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 8_000 });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage).toHaveURL(new RegExp(`/admin/orders/${linkedA.orderId}/edit`));
  
      // Create the after order constant.
      const afterOrder = await getOrderById(linkedA.orderId);
      // Create the after res constant.
      const afterRes = await getReservationById(linkedA.reservationId);
      // Assert that the value matches the intended expectation.
      expect(String(afterOrder.return_date)).toBe(String(beforeOrder.return_date));
      // Assert that the value matches the intended expectation.
      expect(Number(afterOrder.total_price)).toBe(Number(beforeOrder.total_price));
      // Assert that the value matches the intended expectation.
      expect(String(afterRes.return_date)).toBe(String(beforeRes.return_date));
      // Assert that the value matches the intended expectation.
      expect(Number(afterRes.total_price)).toBe(Number(beforeRes.total_price));
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(beforeBlocks);
      // Wait until the asynchronous operation resolves.
      await assertDateBlockCovers(carId, rangeA.pickupDate, rangeA.returnDate);
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-delete-restore-order", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Admin Delete ${Date.now()}`;
  
  // Call test.describe to perform this step.
  test.describe('ADMIN-003 Delete/restore keep order–reservation consistency', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);
  
    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
  
    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });
  
    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });
  
    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });
  
    // Define a single test case and its expectations.
    test('delete cancels reservation and restore recreates confirmed link', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the email constant.
      const email = uniqueEmail('admin-del');
      // Create the range constant.
      const range = allocateFutureRange({ fromDaysAhead: 30, nights: 3 });
  
      // Create the linked constant.
      const linked = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email, fullName: 'Delete Restore Guest' },
        // Provide the total price field value.
        totalPrice: 165,
      });
  
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(1);
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(linked.reservationId, 'confirmed');
  
      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/orders');
      // Wait until the asynchronous operation resolves.
      await adminPage.getByLabel('Search').fill(email);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(email)).toBeVisible({ timeout: 10_000 });
  
      // Call confirmDeleteDialog to perform this step.
      confirmDeleteDialog(adminPage);
      // Wait until the asynchronous operation resolves.
      await openOrderRowAction(adminPage, email, 'Delete');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Order moved to bin')).toBeVisible({ timeout: 15_000 });
  
      // Create the deleted order constant.
      const deletedOrder = await getOrderById(linked.orderId);
      // Assert that the value matches the intended expectation.
      expect(deletedOrder.is_deleted).toBe(true);
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(linked.reservationId, 'cancelled');
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(0);
  
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Deleted' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(email)).toBeVisible({ timeout: 10_000 });
      // Wait until the asynchronous operation resolves.
      await openOrderRowAction(adminPage, email, 'Restore');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Order restored')).toBeVisible({ timeout: 15_000 });
  
      // Create the restored constant.
      const restored = await getOrderById(linked.orderId);
      // Assert that the value matches the intended expectation.
      expect(restored.is_deleted).toBe(false);
      // Assert that the value matches the intended expectation.
      expect(restored.status).toBe('active');
      // Assert that the value matches the intended expectation.
      expect(restored.reservation_id).toBeTruthy();
  
      // Create the new reservation id constant.
      const newReservationId = Number(restored.reservation_id);
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(newReservationId, 'confirmed');
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(1);
      // Wait until the asynchronous operation resolves.
      await assertDateBlockCovers(carId, range.pickupDate, range.returnDate);
  
      // Create the reservation constant.
      const reservation = await getReservationById(newReservationId);
      // Assert that the value matches the intended expectation.
      expect(reservation.email).toBe(email);
      // Original cancelled reservation may differ from newly linked id
      if (newReservationId === linked.reservationId) {
        // Assert that the value matches the intended expectation.
        expect(reservation.status).toBe('confirmed');
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Wait until the asynchronous operation resolves.
        await assertReservationStatus(linked.reservationId, 'cancelled');
      }
    });
  });
});
