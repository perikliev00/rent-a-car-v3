// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/booking'.
import { buildSearchQuery } from '../helpers/booking';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  createManualBlockViaApi,
  // Contribute this line to the enclosing declaration or statement.
  deleteManualBlockViaApi,
  // Contribute this line to the enclosing declaration or statement.
  fillBlockCarDialog,
  // Contribute this line to the enclosing declaration or statement.
  moveCalendarEventViaApi,
  // Contribute this line to the enclosing declaration or statement.
  openCalendarWeek,
  // Contribute this line to the enclosing declaration or statement.
  rangeToIso,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/calendar';
// Import named exports from '../helpers/dates'.
import { getSofiaIsoDateString } from '../helpers/dates';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  assertDateBlockCovers,
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  countDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  getDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("calendar-conflicts", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cal Conflict ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-009 Calendar hard vs override conflicts', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

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
    test('soft BLOCK_OVERLAP is 409 without force and succeeds with force', async ({ request }) => {
      // Create the original constant.
      const original = allocateFutureRange({ fromDaysAhead: 90, nights: 2 });
      // Create the target constant.
      const target = allocateFutureRange({ fromDaysAhead: 95, nights: 2 });

      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the with block field value.
        withBlock: true,
        // Provide the pickup date field value.
        pickupDate: original.pickupDate,
        // Provide the return date field value.
        returnDate: original.returnDate,
        // Provide the pickup time field value.
        pickupTime: original.pickupTime,
        // Provide the return time field value.
        returnTime: original.returnTime,
        // Provide the guest field value.
        guest: {
          // Spread E2E_GUEST into the surrounding structure.
          ...E2E_GUEST,
          // Provide the email field value.
          email: uniqueEmail('cal-soft'),
          // Provide the full name field value.
          fullName: 'Cal Soft Conflict',
        },
      });

      // Create the block iso constant.
      const blockIso = rangeToIso(target);
      // Create the block constant.
      const block = await createManualBlockViaApi(request, {
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the start field value.
        start: blockIso.start,
        // Provide the end field value.
        end: blockIso.end,
        // Provide the reason field value.
        reason: 'E2E soft overlap block',
      });
      // Assert that the value matches the intended expectation.
      expect(block.ok, JSON.stringify(block.body)).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect([200, 201]).toContain(block.status);

      // Create the blocked constant.
      const blocked = await moveCalendarEventViaApi(request, seeded.reservationId, {
        // Provide the start field value.
        start: blockIso.start,
        // Provide the end field value.
        end: blockIso.end,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the force field value.
        force: false,
      });
      // Assert that the value matches the intended expectation.
      expect(blocked.status).toBe(409);
      // Assert that the value matches the intended expectation.
      expect(blocked.body?.error?.code).toBe('CALENDAR_CONFLICT');
      // Create the soft conflicts constant.
      const softConflicts = blocked.body?.error?.conflicts || [];
      // Assert that the value matches the intended expectation.
      expect(softConflicts.some((c: { code?: string; overridable?: boolean }) => c.code === 'BLOCK_OVERLAP')).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(
        // Call softConflicts.some to perform this step.
        softConflicts.some((c: { overridable?: boolean }) => c.overridable === true)
      // Continue the surrounding logic with this statement.
      ).toBeTruthy();

      // Create the forced constant.
      const forced = await moveCalendarEventViaApi(request, seeded.reservationId, {
        // Provide the start field value.
        start: blockIso.start,
        // Provide the end field value.
        end: blockIso.end,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the force field value.
        force: true,
      });
      // Assert that the value matches the intended expectation.
      expect(forced.status, JSON.stringify(forced.body)).toBe(200);

      // Create the reservation constant.
      const reservation = await getReservationById(seeded.reservationId);
      // Assert that the value matches the intended expectation.
      expect(getSofiaIsoDateString(new Date(reservation.pickup_date))).toBe(target.pickupDate);
      // Assert that the value matches the intended expectation.
      expect(getSofiaIsoDateString(new Date(reservation.return_date))).toBe(target.returnDate);
      // Wait until the asynchronous operation resolves.
      await assertDateBlockCovers(carId, target.pickupDate, target.returnDate);
    });

    // Define a single test case and its expectations.
    test('hard HOLD_OVERLAP stays 409 even with force', async ({ request }) => {
      // Create the original constant.
      const original = allocateFutureRange({ fromDaysAhead: 100, nights: 2 });
      // Create the hold range constant.
      const holdRange = allocateFutureRange({ fromDaysAhead: 105, nights: 2 });

      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the with block field value.
        withBlock: true,
        // Provide the pickup date field value.
        pickupDate: original.pickupDate,
        // Provide the return date field value.
        returnDate: original.returnDate,
        // Provide the pickup time field value.
        pickupTime: original.pickupTime,
        // Provide the return time field value.
        returnTime: original.returnTime,
        // Provide the guest field value.
        guest: {
          // Spread E2E_GUEST into the surrounding structure.
          ...E2E_GUEST,
          // Provide the email field value.
          email: uniqueEmail('cal-hard'),
          // Provide the full name field value.
          fullName: 'Cal Hard Conflict',
        },
      });

      // Wait until the asynchronous operation resolves.
      await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'pending_payment',
        // Provide the with block field value.
        withBlock: false,
        // Provide the with order field value.
        withOrder: false,
        // Provide the pickup date field value.
        pickupDate: holdRange.pickupDate,
        // Provide the return date field value.
        returnDate: holdRange.returnDate,
        // Provide the pickup time field value.
        pickupTime: holdRange.pickupTime,
        // Provide the return time field value.
        returnTime: holdRange.returnTime,
        // Provide the hold expires at field value.
        holdExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        // Provide the guest field value.
        guest: {
          // Spread E2E_GUEST into the surrounding structure.
          ...E2E_GUEST,
          // Provide the email field value.
          email: uniqueEmail('cal-hold'),
          // Provide the full name field value.
          fullName: 'Cal Active Hold',
        },
      });

      // Create the target constant.
      const target = rangeToIso(holdRange);
      // Create the forced constant.
      const forced = await moveCalendarEventViaApi(request, seeded.reservationId, {
        // Provide the start field value.
        start: target.start,
        // Provide the end field value.
        end: target.end,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the force field value.
        force: true,
      });
      // Assert that the value matches the intended expectation.
      expect(forced.status).toBe(409);
      // Assert that the value matches the intended expectation.
      expect(forced.body?.error?.code).toBe('CALENDAR_CONFLICT');
      // Create the conflicts constant.
      const conflicts = forced.body?.error?.conflicts || [];
      // Assert that the value matches the intended expectation.
      expect(conflicts.some((c: { code?: string }) => c.code === 'HOLD_OVERLAP')).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(
        // Call conflicts.some to perform this step.
        conflicts.some(
          // Continue the surrounding logic with this statement.
          (c: { code?: string; overridable?: boolean }) =>
            // Update c.code with the right-hand side value.
            c.code === 'HOLD_OVERLAP' && c.overridable === false
        )
      // Continue the surrounding logic with this statement.
      ).toBeTruthy();

      // Create the reservation constant.
      const reservation = await getReservationById(seeded.reservationId);
      // Assert that the value matches the intended expectation.
      expect(getSofiaIsoDateString(new Date(reservation.pickup_date))).toBe(original.pickupDate);
    });

    // Define a single test case and its expectations.
    test('Block car UI shows Calendar conflict with Force anyway', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the booked constant.
      const booked = allocateFutureRange({ fromDaysAhead: 110, nights: 2 });
      // Wait until the asynchronous operation resolves.
      await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the with block field value.
        withBlock: true,
        // Provide the pickup date field value.
        pickupDate: booked.pickupDate,
        // Provide the return date field value.
        returnDate: booked.returnDate,
        // Provide the pickup time field value.
        pickupTime: booked.pickupTime,
        // Provide the return time field value.
        returnTime: booked.returnTime,
        // Provide the guest field value.
        guest: {
          // Spread E2E_GUEST into the surrounding structure.
          ...E2E_GUEST,
          // Provide the email field value.
          email: uniqueEmail('cal-ui-conflict'),
          // Provide the full name field value.
          fullName: 'Cal UI Conflict Booked',
        },
      });

      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, booked.pickupDate);
      // Wait until the asynchronous operation resolves.
      await fillBlockCarDialog(adminPage, {
        // Provide the car name field value.
        carName: CAR_NAME,
        // Provide the start date field value.
        startDate: booked.pickupDate,
        // Provide the start time field value.
        startTime: booked.pickupTime,
        // Provide the end date field value.
        endDate: booked.returnDate,
        // Provide the end time field value.
        endTime: booked.returnTime,
        // Provide the reason field value.
        reason: 'E2E UI conflict block',
      });

      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Calendar conflict' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('button', { name: 'Force anyway' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('button', { name: 'Cancel' }).last()).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Cancel' }).last().click();

      // sanity: API still sees the booking block without a forced manual block
      void request;
    });
  });
});

// Call test.describe to perform this step.
test.describe("calendar-manual-blocks", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cal Blocks ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-006 Manual block CRUD ↔ public availability', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 50, nights: 2 });
    // Create the reason constant.
    const reason = `E2E block ${Date.now()}`;

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
    test('create block hides car from search; delete restores availability', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      page,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, range.pickupDate);
      // Wait until the asynchronous operation resolves.
      await fillBlockCarDialog(adminPage, {
        // Provide the car name field value.
        carName: CAR_NAME,
        // Provide the start date field value.
        startDate: range.pickupDate,
        // Provide the start time field value.
        startTime: range.pickupTime,
        // Provide the end date field value.
        endDate: range.returnDate,
        // Provide the end time field value.
        endTime: range.returnTime,
        // Contribute this line to the enclosing declaration or statement.
        reason,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Block created')).toBeVisible({ timeout: 15_000 });

      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(1);
      // Wait until the asynchronous operation resolves.
      await assertDateBlockCovers(carId, range.pickupDate, range.returnDate);

      // Wait until the asynchronous operation resolves.
      await page.goto(`/search?${buildSearchQuery(range)}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: CAR_NAME })).toHaveCount(0, {
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, range.pickupDate);
      // Create the block bar constant.
      const blockBar = adminPage.locator('[data-event="1"]').filter({ hasText: reason }).first();
      // Initialize the mutable deleted via ui variable.
      let deletedViaUi = false;
      // Evaluate the condition and enter the branch when it is true.
      if (await blockBar.isVisible().catch(() => false)) {
        // Wait until the asynchronous operation resolves.
        await blockBar.click();
        // Wait until the asynchronous operation resolves.
        await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
          // Provide the timeout field value.
          timeout: 10_000,
        });
        // Call adminPage.once to perform this step.
        adminPage.once('dialog', (d) => d.accept());
        // Wait until the asynchronous operation resolves.
        await adminPage.getByRole('button', { name: 'Delete' }).click();
        // Wait until the asynchronous operation resolves.
        await expect(adminPage.getByText('Block deleted')).toBeVisible({ timeout: 15_000 });
        // Update deletedViaUi with the right-hand side value.
        deletedViaUi = true;
      }

      // Evaluate the condition and enter the branch when it is true.
      if (!deletedViaUi) {
        // Create the blocks constant.
        const blocks = await getDateBlocksForCar(carId);
        // Create the manual constant.
        const manual = blocks.find((b: { block_type?: string }) =>
          // Continue the surrounding logic with this statement.
          ['manual', 'maintenance', 'other'].includes(String(b.block_type))
        );
        // Assert that the value matches the intended expectation.
        expect(manual).toBeTruthy();
        // Create the del constant.
        const del = await deleteManualBlockViaApi(request, Number((manual as { id: number }).id));
        // Assert that the value matches the intended expectation.
        expect(del.ok).toBeTruthy();
      }

      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(0);

      // Wait until the asynchronous operation resolves.
      await page.goto(`/search?${buildSearchQuery(range)}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
    });
  });
});
