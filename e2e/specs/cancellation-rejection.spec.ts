import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
  getPendingCancellationRequest,
  getLatestCancellationRequest,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { signupCustomer, applySessionCookies } from '../helpers/account';

const CAR_NAME = `E2E Cancel Reject ${Date.now()}`;
const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('CROSS-002 Cancellation rejected keeps booking', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 55, nights: 3 });

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

  test('admin reject leaves reservation confirmed in portal', async ({ page, request, adminPage }) => {
    const email = uniqueEmail('cancel-reject');
    const customer = await signupCustomer(request, { email, password: PASSWORD });

    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      userId: customer.userId,
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      guest: { ...E2E_GUEST, email, fullName: 'Cancel Reject Guest' },
    });

    await applySessionCookies(page, customer.session);
    await page.goto(`/account/reservations/${seeded.reservationId}`);
    await page.getByLabel('Reason (optional)').fill('E2E cancel reject');
    await page.getByRole('button', { name: 'Request cancellation' }).click();
    await expect(page.getByText('Cancellation request submitted for review')).toBeVisible({
      timeout: 15_000,
    });

    await adminPage.goto('/admin/reservations');
    await expect(
      adminPage.getByText(new RegExp(`Reservation #${seeded.reservationId}`))
    ).toBeVisible({ timeout: 15_000 });
    await adminPage.getByRole('button', { name: 'Reject' }).first().click();
    await expect(adminPage.getByText('Cancellation request updated')).toBeVisible({
      timeout: 15_000,
    });

    await assertReservationStatus(seeded.reservationId, 'confirmed');
    const latest = await getLatestCancellationRequest(seeded.reservationId);
    expect(latest?.status).toBe('rejected');
    expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();

    await page.goto('/account/reservations');
    await expect(page.getByText(`Reservation #${seeded.reservationId}`)).toBeVisible({
      timeout: 15_000,
    });
  });
});
