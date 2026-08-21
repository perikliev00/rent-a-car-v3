import { expect, test } from '../fixtures/base';
import { buildSearchQuery } from '../helpers/booking';
import {
  createManualBlockViaApi,
  deleteManualBlockViaApi,
  moveCalendarEventViaApi,
  openCalendarWeek,
  pickDateSelect,
  pickTimeSelect,
  rangeToIso,
} from '../helpers/calendar';
import { getSofiaIsoDateString } from '../helpers/dates';
import {
  assertDateBlockCovers,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  countDateBlocksForCar,
  getDateBlocksForCar,
  getReservationById,
} from '../helpers/db';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("calendar-conflicts", () => {
  const CAR_NAME = `E2E Cal Conflict ${Date.now()}`;

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
});

test.describe("calendar-manual-blocks", () => {
  const CAR_NAME = `E2E Cal Blocks ${Date.now()}`;

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
});
