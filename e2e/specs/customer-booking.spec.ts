import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  withDb,
  getReservationUserId,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import {
  signupCustomer,
  applySessionCookies,
  createOwnedHoldViaApi,
} from '../helpers/account';

const CAR_NAME = `E2E Customer Booking ${Date.now()}`;
const PASSWORD = 'Customer123!';

async function findLatestReservationForUser(userId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT id, status, user_id, email
      FROM reservations
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      [userId]
    );
    return result.rows[0] || null;
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('CUST-002 Logged-in customer booking appears in portal', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 60, nights: 3 });

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

  test('authenticated order hold shows on account dashboard', async ({ page, request }) => {
    const email = uniqueEmail('cust-book');
    const customer = await signupCustomer(request, { email, password: PASSWORD });

    await createOwnedHoldViaApi(request, customer.session, {
      carId,
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      pickupLocation: 'office',
      returnLocation: 'office',
      fullName: E2E_GUEST.fullName,
      phoneNumber: E2E_GUEST.phoneNumber,
      email,
      address: E2E_GUEST.address,
      hotelName: E2E_GUEST.hotelName,
    });

    const reservation = await findLatestReservationForUser(customer.userId);
    expect(reservation).toBeTruthy();
    expect(reservation.status).toBe('pending_payment');
    expect(await getReservationUserId(Number(reservation.id))).toBe(customer.userId);

    await applySessionCookies(page, customer.session);
    await page.goto('/account/reservations');
    await expect(page.getByRole('heading', { name: 'My reservations' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(`Reservation #${reservation.id}`)).toBeVisible({
      timeout: 15_000,
    });
  });
});
