// Import named exports from '../fixtures/base'.
import { test, expect } from '../fixtures/base';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  getOrderById,
  // Contribute this line to the enclosing declaration or statement.
  setOrderDeletedAt,
  // Contribute this line to the enclosing declaration or statement.
  withDb,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  allocateFutureRange,
  // Contribute this line to the enclosing declaration or statement.
  formatSofiaIsoDateFromParts,
  // Contribute this line to the enclosing declaration or statement.
  addSofiaCalendarDays,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/dates';
// Import named exports from '../helpers/test-env'.
import { uniqueEmail, E2E_GUEST } from '../helpers/test-env';
// Import named exports from '../helpers/admin-orders'.
import { confirmDeleteDialog, expectToast, openOrderRowAction } from '../helpers/admin-orders';

// Create the car name constant.
const CAR_NAME = `E2E Admin List Bin ${Date.now()}`;

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe('ADMIN-011 Orders filters, expired tab, retention bin', () => {
  // Call test.setTimeout to perform this step.
  test.setTimeout(120_000);

  // Contribute this line to the enclosing declaration or statement.
  let carId: number;
  // Contribute this line to the enclosing declaration or statement.
  let binOrderId: number;
  // Create the email active constant.
  const emailActive = uniqueEmail('list-active');
  // Create the email other constant.
  const emailOther = uniqueEmail('list-other');
  // Create the email expired constant.
  const emailExpired = uniqueEmail('list-expired');
  // Create the email bin constant.
  const emailBin = uniqueEmail('list-bin');

  // Call test.beforeAll to perform this step.
  test.beforeAll(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupE2eCarsByName(CAR_NAME);
    // Store the awaited result in carId.
    carId = await seedE2eFixtures(CAR_NAME);

    // Create the active range constant.
    const activeRange = allocateFutureRange({ fromDaysAhead: 50, nights: 2 });
    // Wait until the asynchronous operation resolves.
    await seedLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the pickup date field value.
      pickupDate: activeRange.pickupDate,
      // Provide the return date field value.
      returnDate: activeRange.returnDate,
      // Provide the guest field value.
      guest: { ...E2E_GUEST, email: emailActive, fullName: 'List Active Guest' },
      // Provide the order status field value.
      orderStatus: 'active',
      // Provide the total price field value.
      totalPrice: 110,
    });

    // Create the other range constant.
    const otherRange = allocateFutureRange({ fromDaysAhead: 55, nights: 2 });
    // Wait until the asynchronous operation resolves.
    await seedLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the pickup date field value.
      pickupDate: otherRange.pickupDate,
      // Provide the return date field value.
      returnDate: otherRange.returnDate,
      // Provide the guest field value.
      guest: { ...E2E_GUEST, email: emailOther, fullName: 'List Other Guest' },
      // Provide the order status field value.
      orderStatus: 'active',
      // Provide the total price field value.
      totalPrice: 110,
    });

    // Create the past pickup constant.
    const pastPickup = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), -10));
    // Create the past return constant.
    const pastReturn = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), -6));
    // Wait until the asynchronous operation resolves.
    await seedLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'completed',
      // Provide the pickup date field value.
      pickupDate: pastPickup,
      // Provide the return date field value.
      returnDate: pastReturn,
      // Provide the guest field value.
      guest: { ...E2E_GUEST, email: emailExpired, fullName: 'List Expired Guest' },
      // Provide the order status field value.
      orderStatus: 'expired',
      // Provide the total price field value.
      totalPrice: 220,
      // Provide the hold expires at field value.
      holdExpiresAt: new Date(Date.now() - 86400000),
    });

    // Create the bin range constant.
    const binRange = allocateFutureRange({ fromDaysAhead: 60, nights: 2 });
    // Create the bin constant.
    const bin = await seedLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the pickup date field value.
      pickupDate: binRange.pickupDate,
      // Provide the return date field value.
      returnDate: binRange.returnDate,
      // Provide the guest field value.
      guest: { ...E2E_GUEST, email: emailBin, fullName: 'List Bin Guest' },
      // Provide the order status field value.
      orderStatus: 'active',
      // Provide the total price field value.
      totalPrice: 110,
    });
    // Update binOrderId with the right-hand side value.
    binOrderId = bin.orderId;
  });

  // Call test.afterAll to perform this step.
  test.afterAll(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('search filter finds matching active order', async ({ adminPage }) => {
    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/orders');
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Orders' })).toBeVisible();

    // Wait until the asynchronous operation resolves.
    await adminPage.getByLabel('Search').fill(emailActive);
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(emailActive)).toBeVisible({ timeout: 10_000 });
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(emailOther)).toHaveCount(0);

    // Wait until the asynchronous operation resolves.
    await adminPage.getByLabel('Status').selectOption({ label: 'Active' });
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(emailActive)).toBeVisible();
  });

  // Define a single test case and its expectations.
  test('expired tab lists expired orders', async ({ adminPage }) => {
    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/orders');
    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('button', { name: 'Active' }).click();
    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('button', { name: 'Expired' }).click();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(emailExpired)).toBeVisible({ timeout: 10_000 });
  });

  // Define a single test case and its expectations.
  test('deleted tab restore and empty bin after retention age', async ({ adminPage }) => {
    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/orders');
    // Wait until the asynchronous operation resolves.
    await adminPage.getByLabel('Search').fill(emailBin);
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(emailBin)).toBeVisible({ timeout: 10_000 });

    // Call confirmDeleteDialog to perform this step.
    confirmDeleteDialog(adminPage);
    // Wait until the asynchronous operation resolves.
    await openOrderRowAction(adminPage, emailBin, 'Delete');
    // Wait until the asynchronous operation resolves.
    await expectToast(adminPage, 'Order moved to bin');

    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('button', { name: 'Deleted' }).click();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(emailBin)).toBeVisible({ timeout: 10_000 });

    // Wait until the asynchronous operation resolves.
    await openOrderRowAction(adminPage, emailBin, 'Restore');
    // Wait until the asynchronous operation resolves.
    await expectToast(adminPage, 'Order restored');

    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('button', { name: 'Active' }).click();
    // Wait until the asynchronous operation resolves.
    await adminPage.getByLabel('Search').fill(emailBin);
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(emailBin)).toBeVisible({ timeout: 10_000 });

    // Call confirmDeleteDialog to perform this step.
    confirmDeleteDialog(adminPage);
    // Wait until the asynchronous operation resolves.
    await openOrderRowAction(adminPage, emailBin, 'Delete');
    // Wait until the asynchronous operation resolves.
    await expectToast(adminPage, 'Order moved to bin');

    // Create the old constant.
    const old = new Date();
    // Call old.setDate to perform this step.
    old.setDate(old.getDate() - 60);
    // Wait until the asynchronous operation resolves.
    await setOrderDeletedAt(binOrderId, old);
    // Wait until the asynchronous operation resolves.
    await expect
      // Call .poll to perform this step.
      .poll(async () => {
        // Create the row constant.
        const row = await getOrderById(binOrderId);
        // Evaluate the condition and enter the branch when it is true.
        if (!row?.deleted_at) return 0;
        // Return the resulting value to the caller.
        return Date.now() - new Date(row.deleted_at).getTime();
      })
      // Call .toBeGreaterThan to perform this step.
      .toBeGreaterThan(50 * 24 * 60 * 60 * 1000);

    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/orders');
    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('button', { name: 'Deleted' }).click();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(/Deleted orders are kept for/i)).toBeVisible();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(emailBin)).toBeVisible({ timeout: 10_000 });

    // Create the confirm text constant.
    const confirmText = 'EMPTY DELETED ORDERS';
    // Wait until the asynchronous operation resolves.
    await adminPage.getByLabel(new RegExp(confirmText)).fill(confirmText);
    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('button', { name: 'Empty bin' }).click();
    // Wait until the asynchronous operation resolves.
    await expectToast(adminPage, /Permanently deleted \d+ orders/, { waitForHide: false });

    // Create the gone constant.
    const gone = await getOrderById(binOrderId);
    // Assert that the value matches the intended expectation.
    expect(gone).toBeNull();

    // Create the still there constant.
    const stillThere = await withDb(async (client) => {
      // Create the result constant.
      const result = await client.query(`SELECT id FROM orders WHERE email = $1`, [emailActive]);
      // Return the resulting value to the caller.
      return result.rows.length;
    });
    // Assert that the value matches the intended expectation.
    expect(stillThere).toBeGreaterThan(0);
  });
});
