// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/booking'.
import { buildSearchQuery } from '../helpers/booking';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  calendarEventTestId,
  // Contribute this line to the enclosing declaration or statement.
  clickEmptyCalendarSlot,
  // Contribute this line to the enclosing declaration or statement.
  createTaskFromQuickCreate,
  // Contribute this line to the enclosing declaration or statement.
  openCalendarMonth,
  // Contribute this line to the enclosing declaration or statement.
  openCalendarWeek,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/calendar';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  addSofiaCalendarDays,
  // Contribute this line to the enclosing declaration or statement.
  formatSofiaIsoDateFromParts,
  // Contribute this line to the enclosing declaration or statement.
  getSofiaIsoDateString,
  // Contribute this line to the enclosing declaration or statement.
  parseSofiaDate,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/dates';
// Import named exports from the referenced module.
import {
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
  getCarStatus,
  // Contribute this line to the enclosing declaration or statement.
  insertTestAdmin,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/rbac'.
import { STAFF_PASSWORD, cleanupTestStaff, insertTestStaff, loginAsStaff } from '../helpers/rbac';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { ADMIN_BASE_URL, E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("calendar-mark-pickup-return", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cal Mark PU ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Calendar Mark pickup / Mark return (94)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the today constant.
    const today = getSofiaIsoDateString();
    // Create the return date constant.
    const returnDate = formatSofiaIsoDateFromParts(
      // Call addSofiaCalendarDays to perform this step.
      addSofiaCalendarDays(parseSofiaDate(today, '00:00') ?? new Date(), 2)
    );
    // Create the guest email constant.
    const guestEmail = uniqueEmail('cal-mark');
    // Create the guest name constant.
    const guestName = `Mark PU Guest ${Date.now()}`;

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
    test('Event details Mark pickup then Mark return updates status and fleet', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'car_prepared',
        // Provide the with block field value.
        withBlock: true,
        // Provide the pickup date field value.
        pickupDate: today,
        // Contribute this line to the enclosing declaration or statement.
        returnDate,
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '10:00',
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, today);
      // Wait until the asynchronous operation resolves.
      await adminPage.getByTestId(calendarEventTestId(seeded.reservationId)).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 10_000,
      });

      // Wait until the asynchronous operation resolves.
      await adminPage.getByTestId('mark-pickup').click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Marked picked up')).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(async () => {
          // Start a try block for operations that may fail.
          try {
            // Wait until the asynchronous operation resolves.
            await assertReservationStatus(seeded.reservationId, 'picked_up');
            // Return the resulting value to the caller.
            return true;
          // Contribute this line to the enclosing declaration or statement.
          } catch {
            // Return the resulting value to the caller.
            return false;
          }
        // Continue the surrounding logic with this statement.
        }, { timeout: 15_000 })
        // Call .toBe to perform this step.
        .toBe(true);
      // Wait until the asynchronous operation resolves.
      await assertStatusHistoryContains(seeded.reservationId, 'picked_up');
      // Assert that the value matches the intended expectation.
      expect(await getCarStatus(carId)).toBe('rented');

      // markStatus closes the drawer — reopen for Mark return
      await openCalendarWeek(adminPage, today);
      // Wait until the asynchronous operation resolves.
      await adminPage.getByTestId(calendarEventTestId(seeded.reservationId)).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 10_000,
      });
      // Wait until the asynchronous operation resolves.
      await adminPage.getByTestId('mark-return').click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Marked returned')).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(async () => {
          // Start a try block for operations that may fail.
          try {
            // Wait until the asynchronous operation resolves.
            await assertReservationStatus(seeded.reservationId, 'returned');
            // Return the resulting value to the caller.
            return true;
          // Contribute this line to the enclosing declaration or statement.
          } catch {
            // Return the resulting value to the caller.
            return false;
          }
        // Continue the surrounding logic with this statement.
        }, { timeout: 15_000 })
        // Call .toBe to perform this step.
        .toBe(true);
      // Wait until the asynchronous operation resolves.
      await assertStatusHistoryContains(seeded.reservationId, 'returned');
      // Assert that the value matches the intended expectation.
      expect(await getCarStatus(carId)).toBe('needs_cleaning');
    });
  });
});

// Call test.describe to perform this step.
test.describe("calendar-cancel-reservation", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cal Cancel ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-019 Calendar cancel reservation', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 52, nights: 3 });
    // Create the guest name constant.
    const guestName = `Cal Cancel Guest ${Date.now()}`;
    // Create the guest email constant.
    const guestEmail = uniqueEmail('cal-cancel');

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
      await cleanupReservationsForCar(carId);
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('cancel from event drawer frees block and restores search', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      page,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the with block field value.
        withBlock: true,
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(1);

      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, range.pickupDate);
      // Wait until the asynchronous operation resolves.
      await adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first().click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 10_000,
      });

      // Call adminPage.once to perform this step.
      adminPage.once('dialog', (d) => d.accept());
      // Wait until the asynchronous operation resolves.
      await adminPage.getByTestId('cancel-reservation').click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Reservation cancelled')).toBeVisible({ timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(seeded.reservationId, 'cancelled');
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(0);

      // Wait until the asynchronous operation resolves.
      await page.goto(`/search?${buildSearchQuery(range)}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
    });
  });
});

// Call test.describe to perform this step.
test.describe("calendar-day-ops-details", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cal DayOps ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-020 Calendar day ops + reservation deep links', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the today constant.
    const today = getSofiaIsoDateString();
    // Create the return date constant.
    const returnDate = formatSofiaIsoDateFromParts(
      // Call addSofiaCalendarDays to perform this step.
      addSofiaCalendarDays(parseSofiaDate(today, '00:00') ?? new Date(), 3)
    );
    // Create the guest name constant.
    const guestName = `Day Ops Guest ${Date.now()}`;
    // Create the guest email constant.
    const guestEmail = uniqueEmail('day-ops');

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
      await cleanupReservationsForCar(carId);
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('day ops pickups and event drawer open reservation ops', async ({ adminPage }) => {
      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the with block field value.
        withBlock: true,
        // Provide the pickup date field value.
        pickupDate: today,
        // Contribute this line to the enclosing declaration or statement.
        returnDate,
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '10:00',
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      // Wait until the asynchronous operation resolves.
      await openCalendarMonth(adminPage, today);

      // Destructure array values into local variables.
      const [y, m, d] = today.split('-').map(Number);
      // Create the local date constant.
      const localDate = new Date(y, m - 1, d);
      // Create the weekday constant.
      const weekday = localDate.toLocaleDateString('en-US', { weekday: 'short' });
      // Wait until the asynchronous operation resolves.
      await adminPage
        // Call .getByTestId to perform this step.
        .getByTestId('month-fleet-grid')
        // Call .getByRole to perform this step.
        .getByRole('button')
        // Call .filter to perform this step.
        .filter({ hasText: weekday })
        // Call .filter to perform this step.
        .filter({ hasText: String(d) })
        // Call .first to perform this step.
        .first()
        // Call .click to perform this step.
        .click();

      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByRole to perform this step.
        adminPage.getByRole('heading', { name: new RegExp(`Day ops ·`) })
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('button', { name: /Pickups/ })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(guestName)).toBeVisible({ timeout: 10_000 });

      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Open' }).first().click();
      // Wait until the asynchronous operation resolves.
      await adminPage.waitForURL(new RegExp(`/admin/reservations\\?id=${seeded.reservationId}`), {
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, today);
      // Wait until the asynchronous operation resolves.
      await adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first().click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 10_000,
      });

      // Wait until the asynchronous operation resolves.
      await adminPage.getByTestId('open-reservation-ops').click();
      // Wait until the asynchronous operation resolves.
      await adminPage.waitForURL(new RegExp(`/admin/reservations\\?id=${seeded.reservationId}`), {
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, today);
      // Create the url constant.
      const url = new URL(adminPage.url());
      // Assert that the value matches the intended expectation.
      expect(url.searchParams.has('view')).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(url.searchParams.has('date')).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(url.searchParams.has('id')).toBeFalsy();
      // Assert that the value matches the intended expectation.
      expect(url.searchParams.has('event')).toBeFalsy();
      // Assert that the value matches the intended expectation.
      expect(url.searchParams.has('eventId')).toBeFalsy();
    });
  });
});

// Call test.describe to perform this step.
test.describe("calendar-create-task-slot", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cal Task Slot ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Calendar create task from empty slot (93)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Continue the surrounding logic with this statement.
    let driverEmail: string | null = null;
    // Create the today constant.
    const today = getSofiaIsoDateString();
    // Create the due date constant.
    const dueDate = formatSofiaIsoDateFromParts(
      // Call addSofiaCalendarDays to perform this step.
      addSofiaCalendarDays(parseSofiaDate(today, '00:00') ?? new Date(), 1)
    );

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (driverEmail) await cleanupTestStaff(driverEmail).catch(() => undefined);
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('empty slot Quick create → task on board and driver queue', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      browser,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await insertTestAdmin();
      // Create the driver constant.
      const driver = await insertTestStaff({ roleSlug: 'driver' });
      // Update driverEmail with the right-hand side value.
      driverEmail = driver.email;

      // Create the title constant.
      const title = `E2E Slot Task ${Date.now()}`;
      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, today);
      // Wait until the asynchronous operation resolves.
      await clickEmptyCalendarSlot(adminPage, carId);
      // Wait until the asynchronous operation resolves.
      await createTaskFromQuickCreate(adminPage, {
        // Contribute this line to the enclosing declaration or statement.
        title,
        // Provide the task type label field value.
        taskTypeLabel: 'Pickup',
        // Provide the car name field value.
        carName: CAR_NAME,
        // Provide the assignee email field value.
        assigneeEmail: driver.email,
        // Provide the starts date field value.
        startsDate: today,
        // Contribute this line to the enclosing declaration or statement.
        dueDate,
      });

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/tasks');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Task board' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(title)).toBeVisible({ timeout: 15_000 });

      // Create the driver ctx constant.
      const driverCtx = await browser.newContext({ baseURL: ADMIN_BASE_URL });
      // Create the driver page constant.
      const driverPage = await driverCtx.newPage();
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await driverPage.goto('/login');
        // Wait until the asynchronous operation resolves.
        await driverPage.getByLabel('Email').fill(driver.email);
        // Wait until the asynchronous operation resolves.
        await driverPage.getByLabel('Password', { exact: true }).fill(STAFF_PASSWORD);
        // Wait until the asynchronous operation resolves.
        await driverPage.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
        // Wait until the asynchronous operation resolves.
        await driverPage.waitForURL(/\/admin/, { timeout: 15_000 });
        // Wait until the asynchronous operation resolves.
        await driverPage.goto('/admin/tasks/driver');
        // Wait until the asynchronous operation resolves.
        await expect(driverPage.getByText(title)).toBeVisible({ timeout: 15_000 });
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Wait until the asynchronous operation resolves.
        await driverCtx.close();
      }

      // Touch loginAsStaff so session helper stays exercised for cleanup paths.
      await loginAsStaff(request, driver);
    });
  });
});
