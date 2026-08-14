import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getPendingCancellationRequest,
  withDb,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { signupCustomer, applySessionCookies } from '../helpers/account';

const CAR_NAME = `E2E Cancel Double ${Date.now()}`;
const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('Double cancellation request (97)', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 60, nights: 3 });

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

  test('second request shows pending copy; admin sees one row', async ({
    page,
    request,
    adminPage,
  }) => {
    const email = uniqueEmail('cancel-double');
    const customer = await signupCustomer(request, { email, password: PASSWORD });

    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      userId: customer.userId,
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      guest: { ...E2E_GUEST, email, fullName: 'Cancel Double Guest' },
    });

    await applySessionCookies(page, customer.session);
    await page.goto(`/account/reservations/${seeded.reservationId}`);
    await expect(
      page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByLabel('Reason (optional)').fill('First request');
    await page.getByRole('button', { name: 'Request cancellation' }).click();
    await expect(page.getByText('Cancellation request submitted for review')).toBeVisible({
      timeout: 15_000,
    });
    expect(await getPendingCancellationRequest(seeded.reservationId)).toBeTruthy();

    await page.goto(`/account/reservations/${seeded.reservationId}`);
    await expect(page.getByText('A cancellation request is pending admin review.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Request cancellation' })).toHaveCount(0);

    const pendingCount = await withDb(async (client) => {
      const result = await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM reservation_cancellation_requests
        WHERE reservation_id = $1 AND status = 'pending'
        `,
        [seeded.reservationId]
      );
      return Number(result.rows[0].count);
    });
    expect(pendingCount).toBe(1);

    await adminPage.goto('/admin/reservations');
    await expect(adminPage.getByRole('heading', { name: 'Cancellation requests' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      adminPage.getByText(new RegExp(`Reservation #${seeded.reservationId}`))
    ).toHaveCount(1);
  });
});
