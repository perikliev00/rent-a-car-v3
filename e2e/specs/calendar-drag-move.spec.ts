import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertDateBlockCovers,
  getReservationById,
  getOrderById,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import {
  openCalendarWeek,
  createManualBlockViaApi,
  dragCalendarEventByOffset,
  calendarEventTestId,
  rangeToIso,
} from '../helpers/calendar';
import { getSofiaIsoDateString, formatSofiaIsoDateFromParts, addSofiaCalendarDays, parseSofiaDate } from '../helpers/dates';

const CAR_NAME = `E2E Cal Drag ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Calendar UI drag move (84)', () => {
  test.setTimeout(180_000);

  let carId: number;
  const original = allocateFutureRange({ fromDaysAhead: 200, nights: 2 });
  const guestName = `Cal Drag Guest ${Date.now()}`;
  const guestEmail = uniqueEmail('cal-drag');

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

    // Drag earlier in the week — seeded ranges often sit at the right edge of the week view.
    await dragCalendarEventByOffset(adminPage, seeded.reservationId, { dayOffsetPx: -320 });
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
    expect(movedReturn).not.toBe(original.returnDate);

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
      dayOffsetPx: 400,
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
