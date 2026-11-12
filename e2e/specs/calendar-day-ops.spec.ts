import { expect, test } from '../fixtures/base';
import { buildSearchQuery } from '../helpers/booking';
import {
  calendarEventTestId,
  clickEmptyCalendarSlot,
  createTaskFromQuickCreate,
  openCalendarMonth,
  openCalendarWeek,
} from '../helpers/calendar';
import {
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
  getSofiaIsoDateString,
  parseSofiaDate,
} from '../helpers/dates';
import {
  assertReservationStatus,
  assertStatusHistoryContains,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  countDateBlocksForCar,
  getCarStatus,
  insertTestAdmin,
} from '../helpers/db';
import { STAFF_PASSWORD, cleanupTestStaff, insertTestStaff, loginAsStaff } from '../helpers/rbac';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { ADMIN_BASE_URL, E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("calendar-mark-pickup-return", () => {
  const CAR_NAME = `E2E Cal Mark PU ${Date.now()}`;

  test.describe('Calendar Mark pickup / Mark return (94)', () => {
    test.setTimeout(180_000);

    let carId: number;
    const today = getSofiaIsoDateString();
    const returnDate = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate(today, '00:00') ?? new Date(), 2)
    );
    const guestEmail = uniqueEmail('cal-mark');
    const guestName = `Mark PU Guest ${Date.now()}`;

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

    test('Event details Mark pickup then Mark return updates status and fleet', async ({
      adminPage,
    }) => {
      const seeded = await seedLinkedBooking({
        carId,
        status: 'car_prepared',
        withBlock: true,
        pickupDate: today,
        returnDate,
        pickupTime: '10:00',
        returnTime: '10:00',
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      await openCalendarWeek(adminPage, today);
      await adminPage.getByTestId(calendarEventTestId(seeded.reservationId)).click();
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        timeout: 10_000,
      });

      await adminPage.getByTestId('mark-pickup').click();
      await expect(adminPage.getByText('Marked picked up')).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(async () => {
          try {
            await assertReservationStatus(seeded.reservationId, 'picked_up');
            return true;
          } catch {
            return false;
          }
        }, { timeout: 15_000 })
        .toBe(true);
      await assertStatusHistoryContains(seeded.reservationId, 'picked_up');
      expect(await getCarStatus(carId)).toBe('rented');

      // markStatus closes the drawer — reopen for Mark return
      await openCalendarWeek(adminPage, today);
      await adminPage.getByTestId(calendarEventTestId(seeded.reservationId)).click();
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        timeout: 10_000,
      });
      await adminPage.getByTestId('mark-return').click();
      await expect(adminPage.getByText('Marked returned')).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(async () => {
          try {
            await assertReservationStatus(seeded.reservationId, 'returned');
            return true;
          } catch {
            return false;
          }
        }, { timeout: 15_000 })
        .toBe(true);
      await assertStatusHistoryContains(seeded.reservationId, 'returned');
      expect(await getCarStatus(carId)).toBe('needs_cleaning');
    });
  });
});

test.describe("calendar-cancel-reservation", () => {
  const CAR_NAME = `E2E Cal Cancel ${Date.now()}`;

  test.describe('ADMIN-019 Calendar cancel reservation', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 52, nights: 3 });
    const guestName = `Cal Cancel Guest ${Date.now()}`;
    const guestEmail = uniqueEmail('cal-cancel');

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

    test('cancel from event drawer frees block and restores search', async ({
      adminPage,
      page,
    }) => {
      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        withBlock: true,
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(1);

      await openCalendarWeek(adminPage, range.pickupDate);
      await adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first().click();
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        timeout: 10_000,
      });

      adminPage.once('dialog', (d) => d.accept());
      await adminPage.getByTestId('cancel-reservation').click();
      await expect(adminPage.getByText('Reservation cancelled')).toBeVisible({ timeout: 15_000 });

      await assertReservationStatus(seeded.reservationId, 'cancelled');
      expect(await countDateBlocksForCar(carId)).toBe(0);

      await page.goto(`/search?${buildSearchQuery(range)}`);
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
    });
  });
});

test.describe("calendar-day-ops-details", () => {
  const CAR_NAME = `E2E Cal DayOps ${Date.now()}`;

  test.describe('ADMIN-020 Calendar day ops + reservation deep links', () => {
    test.setTimeout(120_000);

    let carId: number;
    const today = getSofiaIsoDateString();
    const returnDate = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate(today, '00:00') ?? new Date(), 3)
    );
    const guestName = `Day Ops Guest ${Date.now()}`;
    const guestEmail = uniqueEmail('day-ops');

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

    test('day ops pickups and event drawer open reservation ops', async ({ adminPage }) => {
      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        withBlock: true,
        pickupDate: today,
        returnDate,
        pickupTime: '10:00',
        returnTime: '10:00',
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      await openCalendarMonth(adminPage, today);

      const [y, m, d] = today.split('-').map(Number);
      const localDate = new Date(y, m - 1, d);
      const weekday = localDate.toLocaleDateString('en-US', { weekday: 'short' });
      await adminPage
        .getByTestId('month-fleet-grid')
        .getByRole('button')
        .filter({ hasText: weekday })
        .filter({ hasText: String(d) })
        .first()
        .click();

      await expect(
        adminPage.getByRole('heading', { name: new RegExp(`Day ops ·`) })
      ).toBeVisible({ timeout: 15_000 });

      await expect(adminPage.getByRole('button', { name: /Pickups/ })).toBeVisible();
      await expect(adminPage.getByText(guestName)).toBeVisible({ timeout: 10_000 });

      await adminPage.getByRole('button', { name: 'Open' }).first().click();
      await adminPage.waitForURL(new RegExp(`/admin/reservations\\?id=${seeded.reservationId}`), {
        timeout: 15_000,
      });

      await openCalendarWeek(adminPage, today);
      await adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first().click();
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        timeout: 10_000,
      });

      await adminPage.getByTestId('open-reservation-ops').click();
      await adminPage.waitForURL(new RegExp(`/admin/reservations\\?id=${seeded.reservationId}`), {
        timeout: 15_000,
      });

      await openCalendarWeek(adminPage, today);
      const url = new URL(adminPage.url());
      expect(url.searchParams.has('view')).toBeTruthy();
      expect(url.searchParams.has('date')).toBeTruthy();
      expect(url.searchParams.has('id')).toBeFalsy();
      expect(url.searchParams.has('event')).toBeFalsy();
      expect(url.searchParams.has('eventId')).toBeFalsy();
    });
  });
});

test.describe("calendar-create-task-slot", () => {
  const CAR_NAME = `E2E Cal Task Slot ${Date.now()}`;

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

      const driverCtx = await browser.newContext({ baseURL: ADMIN_BASE_URL });
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
});
