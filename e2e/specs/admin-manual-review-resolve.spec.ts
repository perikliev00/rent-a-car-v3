import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
  countDateBlocksForCar,
  countOrdersForCar,
  getOrderByReservationId,
  deleteDateBlocksForCar,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import { changeOpsStatusViaApi } from '../helpers/admin-reservations';
import { loginAsAdmin } from '../helpers/csrf';
import { searchPublicCars } from '../helpers/fleet';

const CAR_NAME = `E2E Manual Review Resolve ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Manual review confirm + refund resolve (83)', () => {
  test.setTimeout(150_000);

  let carId: number;
  const rangeConfirm = allocateFutureRange({ fromDaysAhead: 170, nights: 2 });
  const rangeRefund = allocateFutureRange({ fromDaysAhead: 175, nights: 2 });

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('confirm from manual_review creates order + block; refund frees and clears widget', async ({
    request,
    adminPage,
  }) => {
    await cleanupReservationsForCar(carId);

    const confirmEmail = uniqueEmail('mr-confirm');
    const confirmSeed = await seedLinkedBooking({
      carId,
      status: 'manual_review',
      pickupDate: rangeConfirm.pickupDate,
      returnDate: rangeConfirm.returnDate,
      pickupTime: rangeConfirm.pickupTime,
      returnTime: rangeConfirm.returnTime,
      withOrder: false,
      withBlock: false,
      guest: { ...E2E_GUEST, email: confirmEmail, fullName: 'MR Confirm' },
    });

    // Conflict block mimicking paid-overlap case — clear before confirm (product path).
    await deleteDateBlocksForCar(carId);

    const owner = await loginAsAdmin(request);
    const confirmRes = await changeOpsStatusViaApi(
      request,
      confirmSeed.reservationId,
      'confirmed',
      owner
    );
    expect(confirmRes.ok, JSON.stringify(confirmRes.body)).toBeTruthy();

    await assertReservationStatus(confirmSeed.reservationId, 'confirmed');
    expect(await getOrderByReservationId(confirmSeed.reservationId)).toBeTruthy();
    expect(await countOrdersForCar(carId)).toBe(1);
    expect(await countDateBlocksForCar(carId)).toBe(1);

    const refundEmail = uniqueEmail('mr-refund');
    const refundSeed = await seedLinkedBooking({
      carId,
      status: 'manual_review',
      pickupDate: rangeRefund.pickupDate,
      returnDate: rangeRefund.returnDate,
      pickupTime: rangeRefund.pickupTime,
      returnTime: rangeRefund.returnTime,
      withOrder: false,
      withBlock: true,
      guest: { ...E2E_GUEST, email: refundEmail, fullName: 'MR Refund' },
    });
    expect(await countDateBlocksForCar(carId)).toBeGreaterThanOrEqual(2);

    await adminPage.goto('/admin/reservations');
    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
      timeout: 15_000,
    });
    await adminPage.getByRole('button', { name: 'Refresh' }).click();
    await expect(
      adminPage.getByRole('button', { name: String(refundSeed.reservationId), exact: true }).first()
    ).toBeVisible({ timeout: 15_000 });

    const refundRes = await changeOpsStatusViaApi(
      request,
      refundSeed.reservationId,
      'refunded',
      owner
    );
    expect(refundRes.ok, JSON.stringify(refundRes.body)).toBeTruthy();

    await assertReservationStatus(refundSeed.reservationId, 'refunded');
    expect(await getOrderByReservationId(refundSeed.reservationId)).toBeNull();
    expect(await countDateBlocksForCar(carId)).toBe(1);

    const search = await searchPublicCars(request, {
      pickupDate: rangeRefund.pickupDate,
      returnDate: rangeRefund.returnDate,
      pickupTime: rangeRefund.pickupTime,
      returnTime: rangeRefund.returnTime,
    });
    expect(search.status).toBe(200);
    expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(true);

    await adminPage.getByRole('button', { name: 'Refresh' }).click();
    await expect(
      adminPage.getByRole('button', { name: String(refundSeed.reservationId), exact: true })
    ).toHaveCount(0);
  });
});
