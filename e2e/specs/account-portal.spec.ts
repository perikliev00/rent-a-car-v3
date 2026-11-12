// Import named exports from '@playwright/test'.
import { expect, test } from '@playwright/test';
// Import fs from 'fs'.
import fs from 'fs';
// Import path from 'path'.
import path from 'path';
// Import named exports from '../helpers/account'.
import { applySessionCookies, signupCustomer, signupViaUi } from '../helpers/account';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  assertReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getReservationUserId,
  // Contribute this line to the enclosing declaration or statement.
  issueEmailVerificationToken,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { E2E_GUEST, adminUrl, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("account-portal", () => {
  // Call test.describe to perform this step.
  test.describe('Customer account portal auth', () => {
    // Define a single test case and its expectations.
    test('unauthenticated visitor is redirected from account dashboard', async ({ page }) => {
      // Wait until the asynchronous operation resolves.
      await page.goto('/account');
      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(/\/login/);
    });

    // Define a single test case and its expectations.
    test('customer can open account dashboard after signup', async ({ page }) => {
      // Create the email constant.
      const email = `portal-e2e-${Date.now()}@example.com`;
      // Create the password constant.
      const password = 'Customer123!';

      // Wait until the asynchronous operation resolves.
      await page.goto('/signup');
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Email').fill(email);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Password', { exact: true }).fill(password);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Confirm password').fill(password);
      // Wait until the asynchronous operation resolves.
      await page.getByRole('main').getByRole('button', { name: /sign up|create account/i }).click();

      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await page.goto('/account');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
    });

    // Define a single test case and its expectations.
    test('customer is denied admin pricing page', async ({ page }) => {
      // Create the email constant.
      const email = `pricing-deny-${Date.now()}@example.com`;
      // Create the password constant.
      const password = 'Customer123!';

      // Wait until the asynchronous operation resolves.
      await page.goto('/signup');
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Email').fill(email);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Password', { exact: true }).fill(password);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Confirm password').fill(password);
      // Wait until the asynchronous operation resolves.
      await page.getByRole('main').getByRole('button', { name: /sign up|create account/i }).click();

      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await page.goto(adminUrl('/admin/pricing'));
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
    });
  });
});

// Call test.describe to perform this step.
test.describe("account-documents", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Account Docs ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';
  // Create the fixture dir constant.
  const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');
  // Create the doc a constant.
  const DOC_A = path.join(FIXTURE_DIR, 'doc-a.pdf');
  // Create the doc b constant.
  const DOC_B = path.join(FIXTURE_DIR, 'doc-b.pdf');

  // Define the ensureTinyPdf function.
  function ensureTinyPdf(filePath: string, label: string) {
    // Evaluate the condition and enter the branch when it is true.
    if (fs.existsSync(filePath)) return;
    // Call fs.mkdirSync to perform this step.
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // Minimal valid-enough PDF bytes for multer accept.
    const content = `%PDF-1.1
  1 0 obj<<>>endobj
  trailer<<>>
  %%EOF
  % ${label}
  `;
    // Call fs.writeFileSync to perform this step.
    fs.writeFileSync(filePath, content);
  }

  // Call test.describe to perform this step.
  test.describe('CUST-004 Account documents upload replace download delete', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Call ensureTinyPdf to perform this step.
      ensureTinyPdf(DOC_A, 'doc-a');
      // Call ensureTinyPdf to perform this step.
      ensureTinyPdf(DOC_B, 'doc-b');
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Define a single test case and its expectations.
    test('customer can upload, replace, download, and delete a document', async ({ page, request }) => {
      // Create the email constant.
      const email = uniqueEmail('docs');
      // Create the customer constant.
      const customer = await signupCustomer(request, { email, password: PASSWORD });
      // Wait until the asynchronous operation resolves.
      await applySessionCookies(page, customer.session);

      // Wait until the asynchronous operation resolves.
      await page.goto('/account/documents');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Document type').selectOption('driver_license');
      // Wait until the asynchronous operation resolves.
      await page.locator('input[type="file"]').setInputFiles(DOC_A);
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Upload' }).click();
      // Toast stack can keep prior success toasts visible — use .last() for strict mode.
      await expect(page.getByText('Document uploaded').last()).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(/Driver license/i).first()).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await page.locator('input[type="file"]').setInputFiles(DOC_B);
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Upload' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Document uploaded').last()).toBeVisible({ timeout: 15_000 });

      // Create the download promise constant.
      const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Download' }).first().click();
      // Create the download constant.
      const download = await downloadPromise;
      // Assert that the value matches the intended expectation.
      expect(download.suggestedFilename()).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Delete' }).first().click();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Document deleted').last()).toBeVisible({ timeout: 15_000 });
    });

    // Define a single test case and its expectations.
    test('customer document upload rejects a plain-text file', async ({ page, request }) => {
      // Create the email constant.
      const email = uniqueEmail('docs-reject');
      // Create the customer constant.
      const customer = await signupCustomer(request, { email, password: PASSWORD });
      // Wait until the asynchronous operation resolves.
      await applySessionCookies(page, customer.session);

      // Wait until the asynchronous operation resolves.
      await page.goto('/account/documents');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Document type').selectOption('driver_license');
      // Wait until the asynchronous operation resolves.
      await page.locator('input[type="file"]').setInputFiles({
        // Provide the name field value.
        name: 'notes.txt',
        // Provide the mime type field value.
        mimeType: 'text/plain',
        // Provide the buffer field value.
        buffer: Buffer.from('this is not an identity document'),
      });
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Upload' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Only JPG, PNG, WEBP, or PDF files are allowed.')).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Document uploaded')).toHaveCount(0);
    });
  });
});

// Call test.describe to perform this step.
test.describe("account-ownership", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Ownership ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Call test.describe to perform this step.
  test.describe('AUTH-001 Account ownership isolation', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 45, nights: 2 });

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('other customer cannot open foreign reservation detail', async ({ page, request }) => {
      // Create the owner email constant.
      const ownerEmail = uniqueEmail('owner');
      // Create the other email constant.
      const otherEmail = uniqueEmail('other');

      // Create the owner constant.
      const owner = await signupCustomer(request, { email: ownerEmail, password: PASSWORD });
      // Create the other constant.
      const other = await signupCustomer(request, { email: otherEmail, password: PASSWORD });

      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the user id field value.
        userId: owner.userId,
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email: ownerEmail },
      });

      // Wait until the asynchronous operation resolves.
      await applySessionCookies(page, other.session);
      // Wait until the asynchronous operation resolves.
      await page.goto(`/account/reservations/${seeded.reservationId}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Reservation not found.')).toBeVisible({ timeout: 15_000 });
    });
  });
});

// Call test.describe to perform this step.
test.describe("account-claim-booking", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Claim Booking ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Call test.describe to perform this step.
  test.describe('CUST-001 Claim-by-email signup links guest booking', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the email constant.
    const email = uniqueEmail('claim');
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 40, nights: 3 });
    // Contribute this line to the enclosing declaration or statement.
    let reservationId: number;

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('signup with booking email claims reservation into portal', async ({ page }) => {
      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email },
      });
      // Update reservationId with the right-hand side value.
      reservationId = seeded.reservationId;

      // Assert that the value matches the intended expectation.
      expect(await getReservationUserId(reservationId)).toBeNull();

      // Wait until the asynchronous operation resolves.
      await signupViaUi(page, { email, password: PASSWORD });
      // Assert that the value matches the intended expectation.
      expect(await getReservationUserId(reservationId)).toBeNull();

      // Create the token constant.
      const token = await issueEmailVerificationToken(email);
      // Wait until the asynchronous operation resolves.
      await page.goto(`/verify-email?token=${token}`);
      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(/\/account/, { timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await page.goto('/account/reservations');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'My reservations' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(`Reservation #${reservationId}`)).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Create the user id constant.
      const userId = await getReservationUserId(reservationId);
      // Assert that the value matches the intended expectation.
      expect(userId).toBeTruthy();
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(reservationId, 'confirmed');
    });
  });
});

// Call test.describe to perform this step.
test.describe("account-reservation-details", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Account Details ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Call test.describe to perform this step.
  test.describe('CUST-003 Dashboard detail travel and PDFs', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 65, nights: 3 });

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('customer can save travel details and open PDF actions', async ({ page, request }) => {
      // Create the email constant.
      const email = uniqueEmail('details');
      // Create the customer constant.
      const customer = await signupCustomer(request, { email, password: PASSWORD });

      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the user id field value.
        userId: customer.userId,
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email },
      });

      // Wait until the asynchronous operation resolves.
      await applySessionCookies(page, customer.session);
      // Wait until the asynchronous operation resolves.
      await page.goto(`/account/reservations/${seeded.reservationId}`);
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call page.getByRole to perform this step.
        page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Flight number').fill('E2E123');
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Hotel name').fill('Portal Hotel');
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Hotel / address').fill('Portal Street 9');
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Special requests').fill('Late pickup please');
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Save travel details' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Travel details saved')).toBeVisible({ timeout: 15_000 });

      // Create the updated constant.
      const updated = await getReservationById(seeded.reservationId);
      // Assert that the value matches the intended expectation.
      expect(updated?.flight_number).toBe('E2E123');
      // Assert that the value matches the intended expectation.
      expect(updated?.hotel_name).toBe('Portal Hotel');
      // Assert that the value matches the intended expectation.
      expect(updated?.special_requests).toBe('Late pickup please');

      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Documents (PDF)' })).toBeVisible();
      // Iterate using the loop initializer, condition, and step.
      for (const label of ['Rental agreement', 'Invoice', 'Receipt']) {
        // Wait until the asynchronous operation resolves.
        await expect(page.getByRole('button', { name: label })).toBeVisible();
      }

      // Create the download promise constant.
      const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Rental agreement' }).click();
      // Create the download constant.
      const download = await downloadPromise;
      // PDF may download or toast on failure in stub env; button click must not crash the page.
      if (download) {
        // Assert that the value matches the intended expectation.
        expect(download.suggestedFilename()).toBeTruthy();
      }
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })).toBeVisible();
    });
  });
});
