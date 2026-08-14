import { test, expect } from '@playwright/test';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getReservationUserId,
  assertReservationStatus,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { signupViaUi } from '../helpers/account';

const CAR_NAME = `E2E Claim Booking ${Date.now()}`;
const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('CUST-001 Claim-by-email signup links guest booking', () => {
  test.setTimeout(120_000);

  let carId: number;
  const email = uniqueEmail('claim');
  const range = allocateFutureRange({ fromDaysAhead: 40, nights: 3 });
  let reservationId: number;

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

  test('signup with booking email claims reservation into portal', async ({ page }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      guest: { ...E2E_GUEST, email },
    });
    reservationId = seeded.reservationId;

    expect(await getReservationUserId(reservationId)).toBeNull();

    await signupViaUi(page, { email, password: PASSWORD });

    await page.goto('/account/reservations');
    await expect(page.getByRole('heading', { name: 'My reservations' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(`Reservation #${reservationId}`)).toBeVisible({
      timeout: 15_000,
    });

    const userId = await getReservationUserId(reservationId);
    expect(userId).toBeTruthy();
    await assertReservationStatus(reservationId, 'confirmed');
  });
});
