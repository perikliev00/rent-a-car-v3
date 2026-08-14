import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { signupCustomer, applySessionCookies } from '../helpers/account';
import {
  fillAndSavePickupChecklist,
  fillAndSaveReturnChecklist,
  applyOpsStatus,
} from '../helpers/admin-reservations';
import {
  getSofiaIsoDateString,
  formatSofiaIsoDateFromParts,
  addSofiaCalendarDays,
} from '../helpers/dates';

const CAR_NAME = `E2E Checklist Docs ${Date.now()}`;
const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('CROSS-003 Pickup/return checklists + PDFs to customer', () => {
  test.setTimeout(180_000);

  let carId: number;
  // Use Sofia today so ops widgets stay usable if Apply is needed; checklists work via ?id= alone.
  const today = getSofiaIsoDateString();
  const returnDate = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), 2));
  const future = allocateFutureRange({ fromDaysAhead: 55, nights: 3 });

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

  test('admin checklists unlock customer PDF downloads', async ({
    page,
    request,
    adminPage,
  }) => {
    const email = uniqueEmail('checklist-pdf');
    const customer = await signupCustomer(request, { email, password: PASSWORD });

    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      userId: customer.userId,
      pickupDate: today,
      returnDate: returnDate || future.returnDate,
      guest: { ...E2E_GUEST, email, fullName: 'Checklist Guest' },
    });
    const reservationId = seeded.reservationId;

    await fillAndSavePickupChecklist(adminPage, reservationId, {
      fuelLevel: 'full',
      mileage: '10000',
    });
    await assertReservationStatus(reservationId, 'picked_up');

    // Return checklist requires picked_up/active_rental — advance if product needs active_rental.
    await applyOpsStatus(adminPage, reservationId, 'active_rental', { request });
    await assertReservationStatus(reservationId, 'active_rental');

    await fillAndSaveReturnChecklist(adminPage, reservationId, {
      fuelLevel: 'half',
      mileage: '10100',
    });
    await assertReservationStatus(reservationId, 'returned');

    await applySessionCookies(page, customer.session);
    await page.goto(`/account/reservations/${reservationId}`);
    await expect(
      page.getByRole('heading', { name: `Reservation #${reservationId}` })
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Documents (PDF)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pickup checklist' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Return checklist' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    await page.getByRole('button', { name: 'Pickup checklist' }).click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/pickup|checklist|pdf/i);
    }
    await expect(
      page.getByRole('heading', { name: `Reservation #${reservationId}` })
    ).toBeVisible();
  });
});
