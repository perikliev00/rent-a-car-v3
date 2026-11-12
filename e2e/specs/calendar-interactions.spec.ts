import { expect, test } from '../fixtures/base';
import {
  calendarEventTestId,
  createManualBlockViaApi,
  dragCalendarEventByOffset,
  moveCalendarEventViaApi,
  openCalendarWeek,
  rangeToIso,
  resizeCalendarEventEnd,
} from '../helpers/calendar';
import {
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
  getSofiaIsoDateString,
  parseSofiaDate,
} from '../helpers/dates';
import {
  assertDateBlockCovers,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  getOrderById,
  getReservationById,
} from '../helpers/db';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { E2E_GUEST, allocateFutureRange, allocateFutureRangeOnWeekday, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("calendar-drag-move", () => {
  const CAR_NAME = `E2E Cal Drag ${Date.now()}`;

  test.describe('Calendar UI drag move (84)', () => {
    test.setTimeout(180_000);

    let carId: number;
    // Wednesday pickup: room to drag later in the week without hitting the Monday edge.
    const original = allocateFutureRangeOnWeekday(3, { fromDaysAhead: 21, nights: 2 });
    const guestName = `Cal Drag Guest ${Date.now()}`;
    const guestEmail = uniqueEmail('cal-drag');

    function sofiaDayDiff(fromIso: string, toIso: string): number {
      const [fy, fm, fd] = fromIso.split('-').map(Number);
      const [ty, tm, td] = toIso.split('-').map(Number);
      return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
    }

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

    test('drag moves reservation; Cancel on soft conflict leaves dates unchanged', async ({
      adminPage,
      request,
    }) => {
      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        withBlock: true,
        pickupDate: original.pickupDate,
        returnDate: original.returnDate,
        pickupTime: original.pickupTime,
        returnTime: original.returnTime,
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      const before = await getReservationById(seeded.reservationId);
      const totalBefore = Number(before.total_price);

      await openCalendarWeek(adminPage, original.pickupDate);
      await expect(adminPage.getByTestId(calendarEventTestId(seeded.reservationId))).toBeVisible({
        timeout: 15_000,
      });

      await dragCalendarEventByOffset(adminPage, seeded.reservationId, { days: 1 });
      await expect(adminPage.getByText('Event moved')).toBeVisible({ timeout: 15_000 });

      await expect
        .poll(async () => {
          const row = await getReservationById(seeded.reservationId);
          return getSofiaIsoDateString(new Date(row.pickup_date));
        }, { timeout: 15_000 })
        .not.toBe(original.pickupDate);

      const afterMove = await getReservationById(seeded.reservationId);
      const movedPickup = getSofiaIsoDateString(new Date(afterMove.pickup_date));
      const movedReturn = getSofiaIsoDateString(new Date(afterMove.return_date));
      const shiftDays = sofiaDayDiff(original.pickupDate, movedPickup);
      expect(shiftDays).toBeGreaterThanOrEqual(1);
      expect(shiftDays).toBeLessThanOrEqual(3);
      expect(sofiaDayDiff(movedPickup, movedReturn)).toBe(
        sofiaDayDiff(original.pickupDate, original.returnDate)
      );

      if (seeded.orderId) {
        const order = await getOrderById(seeded.orderId);
        expect(getSofiaIsoDateString(new Date(order.pickup_date))).toBe(movedPickup);
        expect(getSofiaIsoDateString(new Date(order.return_date))).toBe(movedReturn);
        expect(Number(order.total_price)).toBe(Number(afterMove.total_price));
      }
      await assertDateBlockCovers(carId, movedPickup, movedReturn);

      await adminPage.getByTestId(calendarEventTestId(seeded.reservationId)).click();
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        timeout: 10_000,
      });
      const drawer = adminPage.getByRole('dialog');
      await expect(drawer.getByText('Trip').first()).toBeVisible();
      // Drawer uses date-fns `d MMM yyyy HH:mm` (e.g. "1 Mar 2027 13:14"), not zero-padded day.
      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const [, movedMonth, movedDay] = movedPickup.split('-').map(Number);
      await expect(drawer.getByText(/^Pickup$/).locator('..')).toContainText(
        `${movedDay} ${MONTHS[movedMonth - 1]}`
      );

      // Soft conflict: plant a free-range block ahead of the moved trip, drag into it, Cancel.
      await adminPage.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toHaveCount(0);

      const conflictPickup = formatSofiaIsoDateFromParts(
        addSofiaCalendarDays(parseSofiaDate(movedReturn, '00:00') ?? new Date(), 1)
      );
      const conflictReturn = formatSofiaIsoDateFromParts(
        addSofiaCalendarDays(parseSofiaDate(conflictPickup, '00:00') ?? new Date(), 2)
      );
      const { start: conflictStartIso, end: conflictEndIso } = rangeToIso({
        pickupDate: conflictPickup,
        returnDate: conflictReturn,
        pickupTime: afterMove.pickup_time || original.pickupTime,
        returnTime: afterMove.return_time || original.returnTime,
      });
      const blockRes = await createManualBlockViaApi(request, {
        carId,
        start: conflictStartIso,
        end: conflictEndIso,
        force: true,
      });
      expect(blockRes.ok, JSON.stringify(blockRes.body)).toBeTruthy();

      await openCalendarWeek(adminPage, movedPickup);
      await dragCalendarEventByOffset(adminPage, seeded.reservationId, {
        days: 2,
        expectOk: false,
      });
      await expect(adminPage.getByRole('heading', { name: 'Calendar conflict' })).toBeVisible({
        timeout: 15_000,
      });
      await adminPage.getByRole('button', { name: 'Cancel' }).click();
      await expect(adminPage.getByRole('heading', { name: 'Calendar conflict' })).toHaveCount(0);

      const afterCancel = await getReservationById(seeded.reservationId);
      expect(getSofiaIsoDateString(new Date(afterCancel.pickup_date))).toBe(movedPickup);
      expect(getSofiaIsoDateString(new Date(afterCancel.return_date))).toBe(movedReturn);
      expect(Number(afterCancel.total_price)).toBe(Number(afterMove.total_price));
      void totalBefore;
    });
  });
});

test.describe("calendar-ui-resize", () => {
  const CAR_NAME = `E2E Cal UI Resize ${Date.now()}`;

  /** Tuesday pickup so a 2-night stay sits mid-week with room to drag the end handle. */
  function allocateTuesdayStay(fromDaysAhead: number, nights: number) {
    const base = allocateFutureRange({ fromDaysAhead, nights });
    let pickup = base.pickupDate;
    for (let i = 0; i < 7; i += 1) {
      const at = parseSofiaDate(pickup, '12:00');
      const weekday = at
        ? new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Sofia', weekday: 'short' }).format(at)
        : '';
      if (weekday === 'Tue') break;
      pickup = formatSofiaIsoDateFromParts(
        addSofiaCalendarDays(parseSofiaDate(pickup, '00:00') ?? new Date(), 1)
      );
    }
    const returnDate = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate(pickup, '00:00') ?? new Date(), nights)
    );
    return { ...base, pickupDate: pickup, returnDate };
  }

  test.describe('Calendar UI resize (85)', () => {
    test.setTimeout(180_000);

    let carId: number;
    const range = allocateTuesdayStay(210, 2);
    const guestName = `Cal UI Resize ${Date.now()}`;
    const guestEmail = uniqueEmail('cal-ui-resize');

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test('resize end lengthens then shortens with price and block updates', async ({ adminPage }) => {
      await cleanupReservationsForCar(carId);
      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        withBlock: true,
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        dayPrice: 55,
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      const before = await getReservationById(seeded.reservationId);
      const totalBefore = Number(before.total_price);

      await openCalendarWeek(adminPage, range.pickupDate);
      await expect(adminPage.getByTestId(calendarEventTestId(seeded.reservationId))).toBeVisible({
        timeout: 15_000,
      });

      await resizeCalendarEventEnd(adminPage, seeded.reservationId, 160);
      await expect
        .poll(async () => {
          const row = await getReservationById(seeded.reservationId);
          return Number(row.total_price);
        }, { timeout: 15_000 })
        .toBeGreaterThan(totalBefore);
      await expect(adminPage.getByText('Reservation resized')).toBeVisible({ timeout: 5_000 }).catch(
        () => undefined
      );

      const longer = await getReservationById(seeded.reservationId);
      const longerReturn = getSofiaIsoDateString(new Date(longer.return_date));
      expect(longerReturn).not.toBe(range.returnDate);
      expect(Number(longer.total_price)).toBeGreaterThan(totalBefore);
      await assertDateBlockCovers(carId, range.pickupDate, longerReturn);

      await resizeCalendarEventEnd(adminPage, seeded.reservationId, -120);
      await expect
        .poll(async () => {
          const row = await getReservationById(seeded.reservationId);
          return Number(row.total_price);
        }, { timeout: 15_000 })
        .toBeLessThan(Number(longer.total_price));
      await expect(adminPage.getByText('Reservation resized').last()).toBeVisible({
        timeout: 5_000,
      }).catch(() => undefined);

      const shorter = await getReservationById(seeded.reservationId);
      const shorterReturn = getSofiaIsoDateString(new Date(shorter.return_date));
      await assertDateBlockCovers(carId, range.pickupDate, shorterReturn);
    });
  });
});

test.describe("calendar-move-reservation", () => {
  const CAR_NAME = `E2E Cal Move ${Date.now()}`;

  test.describe('ADMIN-007 Calendar move reservation (API)', () => {
    test.setTimeout(120_000);

    let carId: number;
    const original = allocateFutureRange({ fromDaysAhead: 60, nights: 3 });
    const moved = allocateFutureRange({ fromDaysAhead: 70, nights: 3 });
    const guestName = `Cal Move Guest ${Date.now()}`;
    const guestEmail = uniqueEmail('cal-move');

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

    test('API move updates reservation, order, and date block', async ({ adminPage, request }) => {
      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        withBlock: true,
        pickupDate: original.pickupDate,
        returnDate: original.returnDate,
        pickupTime: original.pickupTime,
        returnTime: original.returnTime,
        guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
      });

      const { start, end } = rangeToIso(moved);
      const result = await moveCalendarEventViaApi(request, seeded.reservationId, {
        start,
        end,
        carId,
      });
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(result.ok).toBeTruthy();

      const reservation = await getReservationById(seeded.reservationId);
      expect(reservation).toBeTruthy();
      expect(getSofiaIsoDateString(new Date(reservation.pickup_date))).toBe(moved.pickupDate);
      expect(getSofiaIsoDateString(new Date(reservation.return_date))).toBe(moved.returnDate);

      if (seeded.orderId) {
        const order = await getOrderById(seeded.orderId);
        expect(order).toBeTruthy();
        expect(getSofiaIsoDateString(new Date(order.pickup_date))).toBe(moved.pickupDate);
        expect(getSofiaIsoDateString(new Date(order.return_date))).toBe(moved.returnDate);
        expect(Number(order.total_price)).toBe(Number(reservation.total_price));
      }

      await assertDateBlockCovers(carId, moved.pickupDate, moved.returnDate);

      await openCalendarWeek(adminPage, moved.pickupDate);
      await expect(
        adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first()
      ).toBeVisible({ timeout: 15_000 });
      await adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first().click();
      await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
