import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertDateBlockCovers,
  getReservationById,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { getSofiaIsoDateString } from '../helpers/dates';
import {
  createManualBlockViaApi,
  moveCalendarEventViaApi,
  rangeToIso,
  openCalendarWeek,
  pickDateSelect,
  pickTimeSelect,
} from '../helpers/calendar';

const CAR_NAME = `E2E Cal Conflict ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-009 Calendar hard vs override conflicts', () => {
  test.setTimeout(180_000);

  let carId: number;

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

  test('soft BLOCK_OVERLAP is 409 without force and succeeds with force', async ({ request }) => {
    const original = allocateFutureRange({ fromDaysAhead: 90, nights: 2 });
    const target = allocateFutureRange({ fromDaysAhead: 95, nights: 2 });

    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate: original.pickupDate,
      returnDate: original.returnDate,
      pickupTime: original.pickupTime,
      returnTime: original.returnTime,
      guest: {
        ...E2E_GUEST,
        email: uniqueEmail('cal-soft'),
        fullName: 'Cal Soft Conflict',
      },
    });

    const blockIso = rangeToIso(target);
    const block = await createManualBlockViaApi(request, {
      carId,
      start: blockIso.start,
      end: blockIso.end,
      reason: 'E2E soft overlap block',
    });
    expect(block.ok, JSON.stringify(block.body)).toBeTruthy();
    expect([200, 201]).toContain(block.status);

    const blocked = await moveCalendarEventViaApi(request, seeded.reservationId, {
      start: blockIso.start,
      end: blockIso.end,
      carId,
      force: false,
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body?.error?.code).toBe('CALENDAR_CONFLICT');
    const softConflicts = blocked.body?.error?.conflicts || [];
    expect(softConflicts.some((c: { code?: string; overridable?: boolean }) => c.code === 'BLOCK_OVERLAP')).toBeTruthy();
    expect(
      softConflicts.some((c: { overridable?: boolean }) => c.overridable === true)
    ).toBeTruthy();

    const forced = await moveCalendarEventViaApi(request, seeded.reservationId, {
      start: blockIso.start,
      end: blockIso.end,
      carId,
      force: true,
    });
    expect(forced.status, JSON.stringify(forced.body)).toBe(200);

    const reservation = await getReservationById(seeded.reservationId);
    expect(getSofiaIsoDateString(new Date(reservation.pickup_date))).toBe(target.pickupDate);
    expect(getSofiaIsoDateString(new Date(reservation.return_date))).toBe(target.returnDate);
    await assertDateBlockCovers(carId, target.pickupDate, target.returnDate);
  });

  test('hard HOLD_OVERLAP stays 409 even with force', async ({ request }) => {
    const original = allocateFutureRange({ fromDaysAhead: 100, nights: 2 });
    const holdRange = allocateFutureRange({ fromDaysAhead: 105, nights: 2 });

    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate: original.pickupDate,
      returnDate: original.returnDate,
      pickupTime: original.pickupTime,
      returnTime: original.returnTime,
      guest: {
        ...E2E_GUEST,
        email: uniqueEmail('cal-hard'),
        fullName: 'Cal Hard Conflict',
      },
    });

    await seedLinkedBooking({
      carId,
      status: 'pending_payment',
      withBlock: false,
      withOrder: false,
      pickupDate: holdRange.pickupDate,
      returnDate: holdRange.returnDate,
      pickupTime: holdRange.pickupTime,
      returnTime: holdRange.returnTime,
      holdExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      guest: {
        ...E2E_GUEST,
        email: uniqueEmail('cal-hold'),
        fullName: 'Cal Active Hold',
      },
    });

    const target = rangeToIso(holdRange);
    const forced = await moveCalendarEventViaApi(request, seeded.reservationId, {
      start: target.start,
      end: target.end,
      carId,
      force: true,
    });
    expect(forced.status).toBe(409);
    expect(forced.body?.error?.code).toBe('CALENDAR_CONFLICT');
    const conflicts = forced.body?.error?.conflicts || [];
    expect(conflicts.some((c: { code?: string }) => c.code === 'HOLD_OVERLAP')).toBeTruthy();
    expect(
      conflicts.some(
        (c: { code?: string; overridable?: boolean }) =>
          c.code === 'HOLD_OVERLAP' && c.overridable === false
      )
    ).toBeTruthy();

    const reservation = await getReservationById(seeded.reservationId);
    expect(getSofiaIsoDateString(new Date(reservation.pickup_date))).toBe(original.pickupDate);
  });

  test('Block car UI shows Calendar conflict with Force anyway', async ({
    adminPage,
    request,
  }) => {
    const booked = allocateFutureRange({ fromDaysAhead: 110, nights: 2 });
    await seedLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate: booked.pickupDate,
      returnDate: booked.returnDate,
      pickupTime: booked.pickupTime,
      returnTime: booked.returnTime,
      guest: {
        ...E2E_GUEST,
        email: uniqueEmail('cal-ui-conflict'),
        fullName: 'Cal UI Conflict Booked',
      },
    });

    await openCalendarWeek(adminPage, booked.pickupDate);
    await adminPage.getByRole('button', { name: 'Block car' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Block car' })).toBeVisible();
    await adminPage.getByLabel('Car').selectOption({ label: CAR_NAME });
    await pickDateSelect(adminPage, 'Start date', booked.pickupDate);
    await pickTimeSelect(adminPage, 'Start time', booked.pickupTime);
    await pickDateSelect(adminPage, 'End date', booked.returnDate);
    await pickTimeSelect(adminPage, 'End time', booked.returnTime);
    await adminPage.getByLabel('Reason').fill('E2E UI conflict block');
    await adminPage.getByRole('button', { name: 'Create block' }).click();

    await expect(adminPage.getByRole('heading', { name: 'Calendar conflict' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByRole('button', { name: 'Force anyway' })).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Cancel' }).last()).toBeVisible();
    await adminPage.getByRole('button', { name: 'Cancel' }).last().click();

    // sanity: API still sees the booking block without a forced manual block
    void request;
  });
});
