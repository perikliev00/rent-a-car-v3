import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  getOrderById,
  setOrderDeletedAt,
  withDb,
} from '../helpers/db';
import {
  allocateFutureRange,
  formatSofiaIsoDateFromParts,
  addSofiaCalendarDays,
} from '../helpers/dates';
import { uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import { confirmDeleteDialog, openOrderRowAction } from '../helpers/admin-orders';

const CAR_NAME = `E2E Admin List Bin ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-011 Orders filters, expired tab, retention bin', () => {
  test.setTimeout(120_000);

  let carId: number;
  let binOrderId: number;
  const emailActive = uniqueEmail('list-active');
  const emailOther = uniqueEmail('list-other');
  const emailExpired = uniqueEmail('list-expired');
  const emailBin = uniqueEmail('list-bin');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);

    const activeRange = allocateFutureRange({ fromDaysAhead: 50, nights: 2 });
    await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: activeRange.pickupDate,
      returnDate: activeRange.returnDate,
      guest: { ...E2E_GUEST, email: emailActive, fullName: 'List Active Guest' },
      orderStatus: 'active',
      totalPrice: 110,
    });

    const otherRange = allocateFutureRange({ fromDaysAhead: 55, nights: 2 });
    await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: otherRange.pickupDate,
      returnDate: otherRange.returnDate,
      guest: { ...E2E_GUEST, email: emailOther, fullName: 'List Other Guest' },
      orderStatus: 'active',
      totalPrice: 110,
    });

    const pastPickup = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), -10));
    const pastReturn = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), -6));
    await seedLinkedBooking({
      carId,
      status: 'completed',
      pickupDate: pastPickup,
      returnDate: pastReturn,
      guest: { ...E2E_GUEST, email: emailExpired, fullName: 'List Expired Guest' },
      orderStatus: 'expired',
      totalPrice: 220,
      holdExpiresAt: new Date(Date.now() - 86400000),
    });

    const binRange = allocateFutureRange({ fromDaysAhead: 60, nights: 2 });
    const bin = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: binRange.pickupDate,
      returnDate: binRange.returnDate,
      guest: { ...E2E_GUEST, email: emailBin, fullName: 'List Bin Guest' },
      orderStatus: 'active',
      totalPrice: 110,
    });
    binOrderId = bin.orderId;
  });

  test.afterAll(async () => {
    await cleanupTestCar(carId);
  });

  test('search filter finds matching active order', async ({ adminPage }) => {
    await adminPage.goto('/admin/orders');
    await expect(adminPage.getByRole('heading', { name: 'Orders' })).toBeVisible();

    await adminPage.getByLabel('Search').fill(emailActive);
    await expect(adminPage.getByText(emailActive)).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText(emailOther)).toHaveCount(0);

    await adminPage.getByLabel('Status').selectOption({ label: 'Active' });
    await expect(adminPage.getByText(emailActive)).toBeVisible();
  });

  test('expired tab lists expired orders', async ({ adminPage }) => {
    await adminPage.goto('/admin/orders');
    await adminPage.getByRole('button', { name: 'Active' }).click();
    await adminPage.getByRole('button', { name: 'Expired' }).click();
    await expect(adminPage.getByText(emailExpired)).toBeVisible({ timeout: 10_000 });
  });

  test('deleted tab restore and empty bin after retention age', async ({ adminPage }) => {
    await adminPage.goto('/admin/orders');
    await adminPage.getByLabel('Search').fill(emailBin);
    await expect(adminPage.getByText(emailBin)).toBeVisible({ timeout: 10_000 });

    confirmDeleteDialog(adminPage);
    await openOrderRowAction(adminPage, emailBin, 'Delete');
    await expect(adminPage.getByText('Order moved to bin')).toBeVisible({ timeout: 15_000 });

    await adminPage.getByRole('button', { name: 'Deleted' }).click();
    await expect(adminPage.getByText(emailBin)).toBeVisible({ timeout: 10_000 });

    await openOrderRowAction(adminPage, emailBin, 'Restore');
    await expect(adminPage.getByText('Order restored')).toBeVisible({ timeout: 15_000 });

    await adminPage.getByRole('button', { name: 'Active' }).click();
    await adminPage.getByLabel('Search').fill(emailBin);
    await expect(adminPage.getByText(emailBin)).toBeVisible({ timeout: 10_000 });

    confirmDeleteDialog(adminPage);
    await openOrderRowAction(adminPage, emailBin, 'Delete');
    await expect(adminPage.getByText('Order moved to bin')).toBeVisible({ timeout: 15_000 });

    const old = new Date();
    old.setDate(old.getDate() - 60);
    await setOrderDeletedAt(binOrderId, old);

    await adminPage.getByRole('button', { name: 'Deleted' }).click();
    await expect(adminPage.getByText(/Deleted orders are kept for/i)).toBeVisible();

    const confirmText = 'EMPTY DELETED ORDERS';
    await adminPage.getByLabel(new RegExp(confirmText)).fill(confirmText);
    await adminPage.getByRole('button', { name: 'Empty bin' }).click();
    await expect(adminPage.getByText(/Permanently deleted \d+ orders/)).toBeVisible({
      timeout: 15_000,
    });

    const gone = await getOrderById(binOrderId);
    expect(gone).toBeNull();

    const stillThere = await withDb(async (client) => {
      const result = await client.query(`SELECT id FROM orders WHERE email = $1`, [emailActive]);
      return result.rows.length;
    });
    expect(stillThere).toBeGreaterThan(0);
  });
});
