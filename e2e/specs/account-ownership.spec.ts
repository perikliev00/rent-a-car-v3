import { test, expect } from '@playwright/test';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { signupCustomer, applySessionCookies } from '../helpers/account';

const CAR_NAME = `E2E Ownership ${Date.now()}`;
const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('AUTH-001 Account ownership isolation', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 45, nights: 2 });

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

  test('other customer cannot open foreign reservation detail', async ({ page, request }) => {
    const ownerEmail = uniqueEmail('owner');
    const otherEmail = uniqueEmail('other');

    const owner = await signupCustomer(request, { email: ownerEmail, password: PASSWORD });
    const other = await signupCustomer(request, { email: otherEmail, password: PASSWORD });

    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      userId: owner.userId,
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      guest: { ...E2E_GUEST, email: ownerEmail },
    });

    await applySessionCookies(page, other.session);
    await page.goto(`/account/reservations/${seeded.reservationId}`);
    await expect(page.getByText('Reservation not found.')).toBeVisible({ timeout: 15_000 });
  });
});
