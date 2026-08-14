import { test, expect } from '../fixtures/base';
import { seedE2eFixtures } from '../helpers/seed';
import { cleanupTestCar, cleanupE2eCarsByName, insertTestAdmin } from '../helpers/db';
import {
  getSofiaIsoDateString,
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
  parseSofiaDate,
} from '../helpers/dates';
import {
  openCalendarWeek,
  clickEmptyCalendarSlot,
  createTaskFromQuickCreate,
} from '../helpers/calendar';
import {
  cleanupTestStaff,
  insertTestStaff,
  loginAsStaff,
  STAFF_PASSWORD,
} from '../helpers/rbac';

const CAR_NAME = `E2E Cal Task Slot ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Calendar create task from empty slot (93)', () => {
  test.setTimeout(180_000);

  let carId: number;
  let driverEmail: string | null = null;
  const today = getSofiaIsoDateString();
  const dueDate = formatSofiaIsoDateFromParts(
    addSofiaCalendarDays(parseSofiaDate(today, '00:00') ?? new Date(), 1)
  );

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    if (driverEmail) await cleanupTestStaff(driverEmail).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('empty slot Quick create → task on board and driver queue', async ({
    adminPage,
    browser,
    request,
  }) => {
    await insertTestAdmin();
    const driver = await insertTestStaff({ roleSlug: 'driver' });
    driverEmail = driver.email;

    const title = `E2E Slot Task ${Date.now()}`;
    await openCalendarWeek(adminPage, today);
    await clickEmptyCalendarSlot(adminPage, carId);
    await createTaskFromQuickCreate(adminPage, {
      title,
      taskTypeLabel: 'Pickup',
      carName: CAR_NAME,
      assigneeEmail: driver.email,
      startsDate: today,
      dueDate,
    });

    await adminPage.goto('/admin/tasks');
    await expect(adminPage.getByRole('heading', { name: 'Task board' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByText(title)).toBeVisible({ timeout: 15_000 });

    const driverCtx = await browser.newContext();
    const driverPage = await driverCtx.newPage();
    try {
      await driverPage.goto('/login');
      await driverPage.getByLabel('Email').fill(driver.email);
      await driverPage.getByLabel('Password', { exact: true }).fill(STAFF_PASSWORD);
      await driverPage.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
      await driverPage.waitForURL(/\/admin/, { timeout: 15_000 });
      await driverPage.goto('/admin/tasks/driver');
      await expect(driverPage.getByText(title)).toBeVisible({ timeout: 15_000 });
    } finally {
      await driverCtx.close();
    }

    // Touch loginAsStaff so session helper stays exercised for cleanup paths.
    await loginAsStaff(request, driver);
  });
});
