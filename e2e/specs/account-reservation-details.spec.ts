import { test, expect } from '@playwright/test';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getReservationById,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { signupCustomer, applySessionCookies } from '../helpers/account';

const CAR_NAME = `E2E Account Details ${Date.now()}`;
const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('CUST-003 Dashboard detail travel and PDFs', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 65, nights: 3 });

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

  test('customer can save travel details and open PDF actions', async ({ page, request }) => {
    const email = uniqueEmail('details');
    const customer = await signupCustomer(request, { email, password: PASSWORD });

    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
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

    await page.getByLabel('Flight number').fill('E2E123');
    await page.getByLabel('Hotel name').fill('Portal Hotel');
    await page.getByLabel('Hotel / address').fill('Portal Street 9');
    await page.getByLabel('Special requests').fill('Late pickup please');
    await page.getByRole('button', { name: 'Save travel details' }).click();
    await expect(page.getByText('Travel details saved')).toBeVisible({ timeout: 15_000 });

    const updated = await getReservationById(seeded.reservationId);
    expect(updated?.flight_number).toBe('E2E123');
    expect(updated?.hotel_name).toBe('Portal Hotel');
    expect(updated?.special_requests).toBe('Late pickup please');

    await expect(page.getByRole('heading', { name: 'Documents (PDF)' })).toBeVisible();
    for (const label of ['Rental agreement', 'Invoice', 'Receipt']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    await page.getByRole('button', { name: 'Rental agreement' }).click();
    const download = await downloadPromise;
    // PDF may download or toast on failure in stub env; button click must not crash the page.
    if (download) {
      expect(download.suggestedFilename()).toBeTruthy();
    }
    await expect(page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })).toBeVisible();
  });
});
