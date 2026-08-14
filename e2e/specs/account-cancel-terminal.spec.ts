import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
  getPendingCancellationRequest,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { signupCustomer, applySessionCookies } from '../helpers/account';
import { apiPost } from '../helpers/csrf';

const CAR_NAME = `E2E Cancel Terminal ${Date.now()}`;
const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('Account cancel on terminal statuses (96)', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 55, nights: 2 });

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

  for (const status of ['completed', 'no_show'] as const) {
    test(`${status}: no Request cancellation and API refuses`, async ({ page, request }) => {
      const email = uniqueEmail(`cancel-${status}`);
      const customer = await signupCustomer(request, { email, password: PASSWORD });

      const seeded = await seedLinkedBooking({
        carId,
        status,
        userId: customer.userId,
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        guest: { ...E2E_GUEST, email, fullName: `Terminal ${status}` },
      });

      await applySessionCookies(page, customer.session);
      await page.goto(`/account/reservations/${seeded.reservationId}`);
      await expect(
        page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })
      ).toBeVisible({ timeout: 15_000 });

      await expect(page.getByRole('button', { name: 'Request cancellation' })).toHaveCount(0);
      expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();

      const res = await apiPost(
        request,
        `/api/account/reservations/${seeded.reservationId}/cancel-request`,
        { reason: 'should fail' },
        customer.session
      );
      expect(res.status()).toBe(422);

      await assertReservationStatus(seeded.reservationId, status);
      expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();
    });
  }
});
