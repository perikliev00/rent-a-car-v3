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

const CAR_NAME = `E2E Cancel Approve ${Date.now()}`;
const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('CROSS-001 Cancellation approved by admin', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 50, nights: 3 });

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

  test('customer request then admin approve cancels booking', async ({ page, request, adminPage }) => {
    const email = uniqueEmail('cancel-approve');
    const customer = await signupCustomer(request, { email, password: PASSWORD });

    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      userId: customer.userId,
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      guest: { ...E2E_GUEST, email, fullName: 'Cancel Approve Guest' },
    });

    await applySessionCookies(page, customer.session);
    await page.goto(`/account/reservations/${seeded.reservationId}`);
    await expect(page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel('Reason (optional)').fill('E2E cancel approve');
    await page.getByRole('button', { name: 'Request cancellation' }).click();
    await expect(page.getByText('Cancellation request submitted for review')).toBeVisible({
      timeout: 15_000,
    });

    expect(await getPendingCancellationRequest(seeded.reservationId)).toBeTruthy();

    await adminPage.goto('/admin/reservations');
    await expect(adminPage.getByRole('heading', { name: 'Cancellation requests' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      adminPage.getByText(new RegExp(`Reservation #${seeded.reservationId}`))
    ).toBeVisible();

    await adminPage.getByRole('button', { name: 'Approve' }).first().click();
    await expect(adminPage.getByText('Cancellation request updated')).toBeVisible({
      timeout: 15_000,
    });

    await assertReservationStatus(seeded.reservationId, 'cancelled');
    const latest = await getLatestCancellationRequest(seeded.reservationId);
    expect(latest?.status).toBe('approved');
    expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();
  });
});
