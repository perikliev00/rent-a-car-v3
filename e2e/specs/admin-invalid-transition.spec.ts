import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
  getStatusHistory,
  countDateBlocksForCar,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { changeOpsStatusViaApi } from '../helpers/admin-reservations';

const CAR_NAME = `E2E Admin Invalid Tx ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-005 Invalid transition no side effects', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 40, nights: 3 });
  const guestEmail = uniqueEmail('invalid-tx');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupTestCar(carId);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('illegal confirmed→completed is rejected without history or block changes', async ({
    request,
  }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      guest: { ...E2E_GUEST, email: guestEmail },
    });
    const reservationId = seeded.reservationId;
    const blocksBefore = await countDateBlocksForCar(carId);
    const historyBefore = await getStatusHistory(reservationId);

    const result = await changeOpsStatusViaApi(request, reservationId, 'completed');
    expect(result.ok).toBeFalsy();
    expect(result.status).toBeGreaterThanOrEqual(400);

    await assertReservationStatus(reservationId, 'confirmed');
    const historyAfter = await getStatusHistory(reservationId);
    expect(historyAfter.length).toBe(historyBefore.length);
    expect(historyAfter.some((h: { new_status?: string }) => h.new_status === 'completed')).toBe(
      false
    );
    expect(await countDateBlocksForCar(carId)).toBe(blocksBefore);
  });
});
