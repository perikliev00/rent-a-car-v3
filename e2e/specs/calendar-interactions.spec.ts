// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  calendarEventTestId,
  // Contribute this line to the enclosing declaration or statement.
  createManualBlockViaApi,
  // Contribute this line to the enclosing declaration or statement.
  dragCalendarEventByOffset,
  // Contribute this line to the enclosing declaration or statement.
  moveCalendarEventViaApi,
  // Contribute this line to the enclosing declaration or statement.
  openCalendarWeek,
  // Contribute this line to the enclosing declaration or statement.
  rangeToIso,
  // Contribute this line to the enclosing declaration or statement.
  resizeCalendarEventEnd,
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
  assertDateBlockCovers,
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  getOrderById,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { E2E_GUEST, allocateFutureRange, allocateFutureRangeOnWeekday, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("calendar-drag-move", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cal Drag ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Calendar UI drag move (84)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Wednesday pickup: room to drag later in the week without hitting the Monday edge.
    const original = allocateFutureRangeOnWeekday(3, { fromDaysAhead: 21, nights: 2 });
    // Create the guest name constant.
    const guestName = `Cal Drag Guest ${Date.now()}`;
    // Create the guest email constant.
    const guestEmail = uniqueEmail('cal-drag');

    // Define the sofiaDayDiff function.
    function sofiaDayDiff(fromIso: string, toIso: string): number {
      // Destructure array values into local variables.
      const [fy, fm, fd] = fromIso.split('-').map(Number);
      // Destructure array values into local variables.
      const [ty, tm, td] = toIso.split('-').map(Number);
      // Return the resulting value to the caller.
      return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
    }

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
    test('drag moves reservation; Cancel on soft conflict leaves dates unchanged', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      request,
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
        pickupDate: original.pickupDate,
        // Provide the return date field value.
        returnDate: original.returnDate,
        // Provide the pickup time field value.
        pickupTime: original.pickupTime,
        // Provide the return time field value.
        returnTime: original.returnTime,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      // Create the before constant.
      const before = await getReservationById(seeded.reservationId);
      // Create the total before constant.
      const totalBefore = Number(before.total_price);

      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, original.pickupDate);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByTestId(calendarEventTestId(seeded.reservationId))).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await dragCalendarEventByOffset(adminPage, seeded.reservationId, { days: 1 });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Event moved')).toBeVisible({ timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(async () => {
          // Create the row constant.
          const row = await getReservationById(seeded.reservationId);
          // Return the resulting value to the caller.
          return getSofiaIsoDateString(new Date(row.pickup_date));
        // Continue the surrounding logic with this statement.
        }, { timeout: 15_000 })
        // Call .not.toBe to perform this step.
        .not.toBe(original.pickupDate);

      // Create the after move constant.
      const afterMove = await getReservationById(seeded.reservationId);
      // Create the moved pickup constant.
      const movedPickup = getSofiaIsoDateString(new Date(afterMove.pickup_date));
      // Create the moved return constant.
      const movedReturn = getSofiaIsoDateString(new Date(afterMove.return_date));
      // Create the shift days constant.
      const shiftDays = sofiaDayDiff(original.pickupDate, movedPickup);
      // Assert that the value matches the intended expectation.
      expect(shiftDays).toBeGreaterThanOrEqual(1);
      // Assert that the value matches the intended expectation.
      expect(shiftDays).toBeLessThanOrEqual(3);
      // Assert that the value matches the intended expectation.
      expect(sofiaDayDiff(movedPickup, movedReturn)).toBe(
        // Call sofiaDayDiff to perform this step.
        sofiaDayDiff(original.pickupDate, original.returnDate)
      );

      // Evaluate the condition and enter the branch when it is true.
      if (seeded.orderId) {
        // Create the order constant.
        const order = await getOrderById(seeded.orderId);
        // Assert that the value matches the intended expectation.
        expect(getSofiaIsoDateString(new Date(order.pickup_date))).toBe(movedPickup);
        // Assert that the value matches the intended expectation.
        expect(getSofiaIsoDateString(new Date(order.return_date))).toBe(movedReturn);
        // Assert that the value matches the intended expectation.
        expect(Number(order.total_price)).toBe(Number(afterMove.total_price));
      }
      // Wait until the asynchronous operation resolves.
      await assertDateBlockCovers(carId, movedPickup, movedReturn);

      // Wait until the asynchronous operation resolves.
      await adminPage.getByTestId(calendarEventTestId(seeded.reservationId)).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 10_000,
      });
      // Create the drawer constant.
      const drawer = adminPage.getByRole('dialog');
      // Wait until the asynchronous operation resolves.
      await expect(drawer.getByText('Trip').first()).toBeVisible();
      // Drawer uses date-fns `d MMM yyyy HH:mm` (e.g. "1 Mar 2027 13:14"), not zero-padded day.
      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      // Destructure array values into local variables.
      const [, movedMonth, movedDay] = movedPickup.split('-').map(Number);
      // Wait until the asynchronous operation resolves.
      await expect(drawer.getByText(/^Pickup$/).locator('..')).toContainText(
        // Continue the surrounding logic with this statement.
        `${movedDay} ${MONTHS[movedMonth - 1]}`
      );

      // Soft conflict: plant a free-range block ahead of the moved trip, drag into it, Cancel.
      await adminPage.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toHaveCount(0);

      // Create the conflict pickup constant.
      const conflictPickup = formatSofiaIsoDateFromParts(
        // Call addSofiaCalendarDays to perform this step.
        addSofiaCalendarDays(parseSofiaDate(movedReturn, '00:00') ?? new Date(), 1)
      );
      // Create the conflict return constant.
      const conflictReturn = formatSofiaIsoDateFromParts(
        // Call addSofiaCalendarDays to perform this step.
        addSofiaCalendarDays(parseSofiaDate(conflictPickup, '00:00') ?? new Date(), 2)
      );
      // Destructure object properties into local variables.
      const { start: conflictStartIso, end: conflictEndIso } = rangeToIso({
        // Provide the pickup date field value.
        pickupDate: conflictPickup,
        // Provide the return date field value.
        returnDate: conflictReturn,
        // Provide the pickup time field value.
        pickupTime: afterMove.pickup_time || original.pickupTime,
        // Provide the return time field value.
        returnTime: afterMove.return_time || original.returnTime,
      });
      // Create the block res constant.
      const blockRes = await createManualBlockViaApi(request, {
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the start field value.
        start: conflictStartIso,
        // Provide the end field value.
        end: conflictEndIso,
        // Provide the force field value.
        force: true,
      });
      // Assert that the value matches the intended expectation.
      expect(blockRes.ok, JSON.stringify(blockRes.body)).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, movedPickup);
      // Wait until the asynchronous operation resolves.
      await dragCalendarEventByOffset(adminPage, seeded.reservationId, {
        // Provide the days field value.
        days: 2,
        // Provide the expect ok field value.
        expectOk: false,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Calendar conflict' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Cancel' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Calendar conflict' })).toHaveCount(0);

      // Create the after cancel constant.
      const afterCancel = await getReservationById(seeded.reservationId);
      // Assert that the value matches the intended expectation.
      expect(getSofiaIsoDateString(new Date(afterCancel.pickup_date))).toBe(movedPickup);
      // Assert that the value matches the intended expectation.
      expect(getSofiaIsoDateString(new Date(afterCancel.return_date))).toBe(movedReturn);
      // Assert that the value matches the intended expectation.
      expect(Number(afterCancel.total_price)).toBe(Number(afterMove.total_price));
      // Evaluate the unary operator expression.
      void totalBefore;
    });
  });
});

// Call test.describe to perform this step.
test.describe("calendar-ui-resize", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cal UI Resize ${Date.now()}`;

  /** Tuesday pickup so a 2-night stay sits mid-week with room to drag the end handle. */
  function allocateTuesdayStay(fromDaysAhead: number, nights: number) {
    // Create the base constant.
    const base = allocateFutureRange({ fromDaysAhead, nights });
    // Initialize the mutable pickup variable.
    let pickup = base.pickupDate;
    // Iterate using the loop initializer, condition, and step.
    for (let i = 0; i < 7; i += 1) {
      // Create the at constant.
      const at = parseSofiaDate(pickup, '12:00');
      // Create the weekday constant.
      const weekday = at
        // Continue the surrounding logic with this statement.
        ? new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Sofia', weekday: 'short' }).format(at)
        // Contribute this line to the enclosing declaration or statement.
        : '';
      // Evaluate the condition and enter the branch when it is true.
      if (weekday === 'Tue') break;
      // Update pickup with the right-hand side value.
      pickup = formatSofiaIsoDateFromParts(
        // Call addSofiaCalendarDays to perform this step.
        addSofiaCalendarDays(parseSofiaDate(pickup, '00:00') ?? new Date(), 1)
      );
    }
    // Create the return date constant.
    const returnDate = formatSofiaIsoDateFromParts(
      // Call addSofiaCalendarDays to perform this step.
      addSofiaCalendarDays(parseSofiaDate(pickup, '00:00') ?? new Date(), nights)
    );
    // Return the resulting value to the caller.
    return { ...base, pickupDate: pickup, returnDate };
  }

  // Call test.describe to perform this step.
  test.describe('Calendar UI resize (85)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateTuesdayStay(210, 2);
    // Create the guest name constant.
    const guestName = `Cal UI Resize ${Date.now()}`;
    // Create the guest email constant.
    const guestEmail = uniqueEmail('cal-ui-resize');

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

    // Define a single test case and its expectations.
    test('resize end lengthens then shortens with price and block updates', async ({ adminPage }) => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
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
        // Provide the day price field value.
        dayPrice: 55,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      // Create the before constant.
      const before = await getReservationById(seeded.reservationId);
      // Create the total before constant.
      const totalBefore = Number(before.total_price);

      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, range.pickupDate);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByTestId(calendarEventTestId(seeded.reservationId))).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await resizeCalendarEventEnd(adminPage, seeded.reservationId, 160);
      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(async () => {
          // Create the row constant.
          const row = await getReservationById(seeded.reservationId);
          // Return the resulting value to the caller.
          return Number(row.total_price);
        // Continue the surrounding logic with this statement.
        }, { timeout: 15_000 })
        // Call .toBeGreaterThan to perform this step.
        .toBeGreaterThan(totalBefore);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Reservation resized')).toBeVisible({ timeout: 5_000 }).catch(
        // Continue the surrounding logic with this statement.
        () => undefined
      );

      // Create the longer constant.
      const longer = await getReservationById(seeded.reservationId);
      // Create the longer return constant.
      const longerReturn = getSofiaIsoDateString(new Date(longer.return_date));
      // Assert that the value matches the intended expectation.
      expect(longerReturn).not.toBe(range.returnDate);
      // Assert that the value matches the intended expectation.
      expect(Number(longer.total_price)).toBeGreaterThan(totalBefore);
      // Wait until the asynchronous operation resolves.
      await assertDateBlockCovers(carId, range.pickupDate, longerReturn);

      // Wait until the asynchronous operation resolves.
      await resizeCalendarEventEnd(adminPage, seeded.reservationId, -120);
      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(async () => {
          // Create the row constant.
          const row = await getReservationById(seeded.reservationId);
          // Return the resulting value to the caller.
          return Number(row.total_price);
        // Continue the surrounding logic with this statement.
        }, { timeout: 15_000 })
        // Call .toBeLessThan to perform this step.
        .toBeLessThan(Number(longer.total_price));
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Reservation resized').last()).toBeVisible({
        // Provide the timeout field value.
        timeout: 5_000,
      // Continue the surrounding logic with this statement.
      }).catch(() => undefined);

      // Create the shorter constant.
      const shorter = await getReservationById(seeded.reservationId);
      // Create the shorter return constant.
      const shorterReturn = getSofiaIsoDateString(new Date(shorter.return_date));
      // Wait until the asynchronous operation resolves.
      await assertDateBlockCovers(carId, range.pickupDate, shorterReturn);
    });
  });
});

// Call test.describe to perform this step.
test.describe("calendar-move-reservation", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cal Move ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-007 Calendar move reservation (API)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the original constant.
    const original = allocateFutureRange({ fromDaysAhead: 60, nights: 3 });
    // Create the moved constant.
    const moved = allocateFutureRange({ fromDaysAhead: 70, nights: 3 });
    // Create the guest name constant.
    const guestName = `Cal Move Guest ${Date.now()}`;
    // Create the guest email constant.
    const guestEmail = uniqueEmail('cal-move');

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
    test('API move updates reservation, order, and date block', async ({ adminPage, request }) => {
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
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      // Destructure object properties into local variables.
      const { start, end } = rangeToIso(moved);
      // Create the result constant.
      const result = await moveCalendarEventViaApi(request, seeded.reservationId, {
        // Contribute this line to the enclosing declaration or statement.
        start,
        // Contribute this line to the enclosing declaration or statement.
        end,
        // Contribute this line to the enclosing declaration or statement.
        carId,
      });
      // Assert that the value matches the intended expectation.
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      // Assert that the value matches the intended expectation.
      expect(result.ok).toBeTruthy();

      // Create the reservation constant.
      const reservation = await getReservationById(seeded.reservationId);
      // Assert that the value matches the intended expectation.
      expect(reservation).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(getSofiaIsoDateString(new Date(reservation.pickup_date))).toBe(moved.pickupDate);
      // Assert that the value matches the intended expectation.
      expect(getSofiaIsoDateString(new Date(reservation.return_date))).toBe(moved.returnDate);

      // Evaluate the condition and enter the branch when it is true.
      if (seeded.orderId) {
        // Create the order constant.
        const order = await getOrderById(seeded.orderId);
        // Assert that the value matches the intended expectation.
        expect(order).toBeTruthy();
        // Assert that the value matches the intended expectation.
        expect(getSofiaIsoDateString(new Date(order.pickup_date))).toBe(moved.pickupDate);
        // Assert that the value matches the intended expectation.
        expect(getSofiaIsoDateString(new Date(order.return_date))).toBe(moved.returnDate);
        // Assert that the value matches the intended expectation.
        expect(Number(order.total_price)).toBe(Number(reservation.total_price));
      }

      // Wait until the asynchronous operation resolves.
      await assertDateBlockCovers(carId, moved.pickupDate, moved.returnDate);

      // Wait until the asynchronous operation resolves.
      await openCalendarWeek(adminPage, moved.pickupDate);
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.locator to perform this step.
        adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first()
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first().click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 10_000,
      });
    });
  });
});
