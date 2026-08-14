import { test, expect } from '../fixtures/base';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  countDateBlocksForCar,
  assertDateBlockCovers,
  getDateBlocksForCar,
} from '../helpers/db';
import { allocateFutureRange } from '../helpers/test-env';
import { buildSearchQuery } from '../helpers/booking';
import {
  openCalendarWeek,
  pickDateSelect,
  pickTimeSelect,
  deleteManualBlockViaApi,
} from '../helpers/calendar';

const CAR_NAME = `E2E Cal Blocks ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-006 Manual block CRUD ↔ public availability', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 50, nights: 2 });
  const reason = `E2E block ${Date.now()}`;

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

  test('create block hides car from search; delete restores availability', async ({
    adminPage,
    page,
    request,
  }) => {
    await openCalendarWeek(adminPage, range.pickupDate);

    await adminPage.getByRole('button', { name: 'Block car' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Block car' })).toBeVisible();

    await adminPage.getByLabel('Car').selectOption({ label: CAR_NAME });
    await pickDateSelect(adminPage, 'Start date', range.pickupDate);
    await pickTimeSelect(adminPage, 'Start time', range.pickupTime);
    await pickDateSelect(adminPage, 'End date', range.returnDate);
    await pickTimeSelect(adminPage, 'End time', range.returnTime);
    await adminPage.getByLabel('Reason').fill(reason);
    await adminPage.getByRole('button', { name: 'Create block' }).click();
    await expect(adminPage.getByText('Block created')).toBeVisible({ timeout: 15_000 });

    expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(1);
    await assertDateBlockCovers(carId, range.pickupDate, range.returnDate);

    await page.goto(`/search?${buildSearchQuery(range)}`);
    await expect(page.getByRole('heading', { name: CAR_NAME })).toHaveCount(0, {
      timeout: 15_000,
    });

    await openCalendarWeek(adminPage, range.pickupDate);
    const blockBar = adminPage.locator('[data-event="1"]').filter({ hasText: reason }).first();
    let deletedViaUi = false;
    if (await blockBar.isVisible().catch(() => false)) {
      await blockBar.click();
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        timeout: 10_000,
      });
      adminPage.once('dialog', (d) => d.accept());
      await adminPage.getByRole('button', { name: 'Delete' }).click();
      await expect(adminPage.getByText('Block deleted')).toBeVisible({ timeout: 15_000 });
      deletedViaUi = true;
    }

    if (!deletedViaUi) {
      const blocks = await getDateBlocksForCar(carId);
      const manual = blocks.find((b: { block_type?: string }) =>
        ['manual', 'maintenance', 'other'].includes(String(b.block_type))
      );
      expect(manual).toBeTruthy();
      const del = await deleteManualBlockViaApi(request, Number((manual as { id: number }).id));
      expect(del.ok).toBeTruthy();
    }

    expect(await countDateBlocksForCar(carId)).toBe(0);

    await page.goto(`/search?${buildSearchQuery(range)}`);
    await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
  });
});
