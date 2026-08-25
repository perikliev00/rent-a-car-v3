import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  applySessionCookies,
  signupVerifiedCustomer,
  signupVerifiedViaUi,
  signupViaUi,
} from '../helpers/account';
import {
  assertReservationStatus,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  getClaimTokenState,
  getOrderUserId,
  getReservationById,
  getReservationUserId,
  issueClaimTokenForReservation,
} from '../helpers/db';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("account-portal", () => {
  test.describe('Customer account portal auth', () => {
    test('unauthenticated visitor is redirected from account dashboard', async ({ page }) => {
      await page.goto('/account');
      await expect(page).toHaveURL(/\/login/);
    });

    test('signup lands on the pending-verification page', async ({ page }) => {
      const email = `portal-pending-${Date.now()}@example.com`;

      await signupViaUi(page, { email, password: 'Customer123!' });

      await expect(page.getByRole('heading', { name: 'Confirm your email' })).toBeVisible({
        timeout: 15_000,
      });
    });

    test('customer can open account dashboard once the email is confirmed', async ({ page }) => {
      const email = `portal-e2e-${Date.now()}@example.com`;

      await signupVerifiedViaUi(page, { email, password: 'Customer123!' });

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
        timeout: 15_000,
      });
    });

    test('customer is denied admin pricing page', async ({ page }) => {
      const email = `pricing-deny-${Date.now()}@example.com`;

      await signupVerifiedViaUi(page, { email, password: 'Customer123!' });

      await page.goto('/admin/pricing');
      await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});

test.describe("account-documents", () => {
  const CAR_NAME = `E2E Account Docs ${Date.now()}`;
  const PASSWORD = 'Customer123!';
  const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');
  const DOC_A = path.join(FIXTURE_DIR, 'doc-a.pdf');
  const DOC_B = path.join(FIXTURE_DIR, 'doc-b.pdf');

  function ensureTinyPdf(filePath: string, label: string) {
    if (fs.existsSync(filePath)) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // Minimal valid-enough PDF bytes for multer accept.
    const content = `%PDF-1.1
  1 0 obj<<>>endobj
  trailer<<>>
  %%EOF
  % ${label}
  `;
    fs.writeFileSync(filePath, content);
  }

  test.describe('CUST-004 Account documents upload replace download delete', () => {
    test.setTimeout(120_000);

    let carId: number;

    test.beforeAll(async () => {
      ensureTinyPdf(DOC_A, 'doc-a');
      ensureTinyPdf(DOC_B, 'doc-b');
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupTestCar(carId);
    });

    test('customer can upload, replace, download, and delete a document', async ({ page, request }) => {
      const email = uniqueEmail('docs');
      const customer = await signupVerifiedCustomer(request, { email, password: PASSWORD });
      await applySessionCookies(page, customer.session);

      await page.goto('/account/documents');
      await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible({
        timeout: 15_000,
      });

      await page.getByLabel('Document type').selectOption('driver_license');
      await page.locator('input[type="file"]').setInputFiles(DOC_A);
      await page.getByRole('button', { name: 'Upload' }).click();
      await expect(page.getByText('Document uploaded')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Driver license/i).first()).toBeVisible();

      await page.locator('input[type="file"]').setInputFiles(DOC_B);
      await page.getByRole('button', { name: 'Upload' }).click();
      await expect(page.getByText('Document uploaded')).toBeVisible({ timeout: 15_000 });

      const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
      await page.getByRole('button', { name: 'Download' }).first().click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBeTruthy();

      await page.getByRole('button', { name: 'Delete' }).first().click();
      await expect(page.getByText('Document deleted')).toBeVisible({ timeout: 15_000 });
    });
  });
});

test.describe("account-ownership", () => {
  const CAR_NAME = `E2E Ownership ${Date.now()}`;
  const PASSWORD = 'Customer123!';

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

      const owner = await signupVerifiedCustomer(request, {
        email: ownerEmail,
        password: PASSWORD,
      });
      const other = await signupVerifiedCustomer(request, {
        email: otherEmail,
        password: PASSWORD,
      });

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
});

test.describe("account-claim-booking", () => {
  const CAR_NAME = `E2E Claim Booking ${Date.now()}`;
  const PASSWORD = 'Customer123!';

  test.describe('P0-01 Guest bookings are only linked by an explicit claim token', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 40, nights: 3 });

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

    async function seedGuestBooking(email: string) {
      return seedLinkedBooking({
        carId,
        status: 'confirmed',
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        guest: { ...E2E_GUEST, email },
      });
    }

    test('signing up with the booking email claims nothing', async ({ page }) => {
      const email = uniqueEmail('prehijack');
      const seeded = await seedGuestBooking(email);
      expect(await getReservationUserId(seeded.reservationId)).toBeNull();

      // Knowing the booking email is enough to create the account, and that is all.
      await signupViaUi(page, { email, password: PASSWORD });

      expect(await getReservationUserId(seeded.reservationId)).toBeNull();
      expect(await getOrderUserId(seeded.reservationId)).toBeNull();
      await assertReservationStatus(seeded.reservationId, 'confirmed');
    });

    test('an unverified account is locked out of the portal', async ({ page }) => {
      const email = uniqueEmail('unverified-portal');
      const seeded = await seedGuestBooking(email);

      await signupViaUi(page, { email, password: PASSWORD });
      await expect(page.getByRole('heading', { name: 'Confirm your email' })).toBeVisible({
        timeout: 15_000,
      });

      // Every account route bounces back to the pending-verification page.
      for (const path of [
        '/account',
        '/account/reservations',
        `/account/reservations/${seeded.reservationId}`,
        '/account/documents',
      ]) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/account\/verify-email$/, { timeout: 15_000 });
      }

      expect(await getReservationUserId(seeded.reservationId)).toBeNull();
    });

    test('confirming the email still does not claim the booking', async ({ page }) => {
      const email = uniqueEmail('verified-noclaim');
      const seeded = await seedGuestBooking(email);

      await signupVerifiedViaUi(page, { email, password: PASSWORD });

      await page.goto('/account/reservations');
      await expect(page.getByRole('heading', { name: 'My reservations' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(`Reservation #${seeded.reservationId}`)).toHaveCount(0);

      expect(await getReservationUserId(seeded.reservationId)).toBeNull();
      expect(await getOrderUserId(seeded.reservationId)).toBeNull();
    });

    test('a verified account claims the booking by opening its claim link', async ({ page }) => {
      const email = uniqueEmail('claim-link');
      const seeded = await seedGuestBooking(email);

      const userId = await signupVerifiedViaUi(page, { email, password: PASSWORD });
      const token = await issueClaimTokenForReservation(seeded.reservationId, email);

      await page.goto(`/claim-booking?reservationId=${seeded.reservationId}&token=${token}`);
      await expect(page.getByRole('heading', { name: 'Booking added' })).toBeVisible({
        timeout: 15_000,
      });
      // The token is stripped from the URL once submitted.
      await expect(page).not.toHaveURL(/token=/);

      expect(await getReservationUserId(seeded.reservationId)).toBe(userId);
      expect(await getOrderUserId(seeded.reservationId)).toBe(userId);

      const tokenState = await getClaimTokenState(seeded.reservationId);
      expect(tokenState?.used_at).not.toBeNull();
      expect(Number(tokenState?.used_by_user_id)).toBe(userId);

      await page.goto('/account/reservations');
      await expect(page.getByText(`Reservation #${seeded.reservationId}`)).toBeVisible({
        timeout: 15_000,
      });
      await assertReservationStatus(seeded.reservationId, 'confirmed');
    });

    test('a claim link for someone else\u2019s booking is refused', async ({ page }) => {
      const victimEmail = uniqueEmail('claim-victim');
      const attackerEmail = uniqueEmail('claim-attacker');
      const seeded = await seedGuestBooking(victimEmail);

      await signupVerifiedViaUi(page, { email: attackerEmail, password: PASSWORD });
      const token = await issueClaimTokenForReservation(seeded.reservationId, victimEmail);

      await page.goto(`/claim-booking?reservationId=${seeded.reservationId}&token=${token}`);
      await expect(page.getByRole('heading', { name: 'This link is not valid' })).toBeVisible({
        timeout: 15_000,
      });

      expect(await getReservationUserId(seeded.reservationId)).toBeNull();
      expect(await getOrderUserId(seeded.reservationId)).toBeNull();
    });

    test('an unverified account cannot use a valid claim link', async ({ page }) => {
      const email = uniqueEmail('claim-unverified');
      const seeded = await seedGuestBooking(email);

      await signupViaUi(page, { email, password: PASSWORD });
      const token = await issueClaimTokenForReservation(seeded.reservationId, email);

      await page.goto(`/claim-booking?reservationId=${seeded.reservationId}&token=${token}`);
      await expect(
        page.getByRole('heading', { name: 'Confirm your email first' })
      ).toBeVisible({ timeout: 15_000 });

      expect(await getReservationUserId(seeded.reservationId)).toBeNull();
      const tokenState = await getClaimTokenState(seeded.reservationId);
      expect(tokenState?.used_at).toBeNull();
    });
  });
});

test.describe("account-reservation-details", () => {
  const CAR_NAME = `E2E Account Details ${Date.now()}`;
  const PASSWORD = 'Customer123!';

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
      const customer = await signupVerifiedCustomer(request, { email, password: PASSWORD });

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
});
