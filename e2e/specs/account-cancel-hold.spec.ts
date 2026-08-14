import { test, expect } from '@playwright/test';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { signupCustomer, applySessionCookies } from '../helpers/account';

const CAR_NAME = `E2E Cancel Hold ${Date.now()}`;
const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('CUST-005 Cancel own active hold immediately', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 70, nights: 2 });

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

  test('customer cancels pending_payment hold from portal immediately', async ({ page, request }) => {
    const email = uniqueEmail('cancel-hold');
    const customer = await signupCustomer(request, { email, password: PASSWORD });

    const seeded = await seedLinkedBooking({
      carId,
      status: 'pending_payment',
      userId: customer.userId,
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      guest: { ...E2E_GUEST, email },
    });

    await applySessionCookies(page, customer.session);
    await page.goto(`/account/reservations/${seeded.reservationId}`);
    await expect(
      page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Request cancellation' }).click();
    await expect(page.getByText('Reservation cancelled')).toBeVisible({ timeout: 15_000 });

    await assertReservationStatus(seeded.reservationId, 'cancelled');
  });
});
