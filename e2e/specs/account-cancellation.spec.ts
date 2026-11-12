// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/account'.
import { applySessionCookies, signupCustomer } from '../helpers/account';
// Import named exports from '../helpers/csrf'.
import { apiPost } from '../helpers/csrf';
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
  getLatestCancellationRequest,
  // Contribute this line to the enclosing declaration or statement.
  getPendingCancellationRequest,
  // Contribute this line to the enclosing declaration or statement.
  withDb,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("account-cancel-hold", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cancel Hold ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Call test.describe to perform this step.
  test.describe('CUST-005 Cancel own active hold immediately', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 70, nights: 2 });

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
    test('customer cancels pending_payment hold from portal immediately', async ({ page, request }) => {
      // Create the email constant.
      const email = uniqueEmail('cancel-hold');
      // Create the customer constant.
      const customer = await signupCustomer(request, { email, password: PASSWORD });

      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'pending_payment',
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
      await page.getByRole('button', { name: 'Request cancellation' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Reservation cancelled')).toBeVisible({ timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(seeded.reservationId, 'cancelled');
    });
  });
});

// Call test.describe to perform this step.
test.describe("account-cancel-double-request", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cancel Double ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Call test.describe to perform this step.
  test.describe('Double cancellation request (97)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 60, nights: 3 });

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
      await cleanupReservationsForCar(carId).catch(() => undefined);
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId).catch(() => undefined);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('second request shows pending copy; admin sees one row', async ({
      // Contribute this line to the enclosing declaration or statement.
      page,
      // Contribute this line to the enclosing declaration or statement.
      request,
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the email constant.
      const email = uniqueEmail('cancel-double');
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
        guest: { ...E2E_GUEST, email, fullName: 'Cancel Double Guest' },
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
      await page.getByLabel('Reason (optional)').fill('First request');
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Request cancellation' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Cancellation request submitted for review')).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Assert that the value matches the intended expectation.
      expect(await getPendingCancellationRequest(seeded.reservationId)).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await page.goto(`/account/reservations/${seeded.reservationId}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('A cancellation request is pending admin review.')).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('button', { name: 'Request cancellation' })).toHaveCount(0);

      // Create the pending count constant.
      const pendingCount = await withDb(async (client) => {
        // Create the result constant.
        const result = await client.query(
          // Continue the surrounding logic with this statement.
          `
          SELECT COUNT(*)::int AS count
          FROM reservation_cancellation_requests
          WHERE reservation_id = $1 AND status = 'pending'
          `,
          // Contribute this line to the enclosing declaration or statement.
          [seeded.reservationId]
        );
        // Return the resulting value to the caller.
        return Number(result.rows[0].count);
      });
      // Assert that the value matches the intended expectation.
      expect(pendingCount).toBe(1);

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/reservations');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Cancellation requests' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByText to perform this step.
        adminPage.getByText(new RegExp(`Reservation #${seeded.reservationId}`))
      // Continue the surrounding logic with this statement.
      ).toHaveCount(1);
    });
  });
});

// Call test.describe to perform this step.
test.describe("account-cancel-terminal", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cancel Terminal ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Call test.describe to perform this step.
  test.describe('Account cancel on terminal statuses (96)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 55, nights: 2 });

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
      await cleanupReservationsForCar(carId).catch(() => undefined);
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId).catch(() => undefined);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Iterate using the loop initializer, condition, and step.
    for (const status of ['completed', 'no_show'] as const) {
      // Define a single test case and its expectations.
      test(`${status}: no Request cancellation and API refuses`, async ({ page, request }) => {
        // Create the email constant.
        const email = uniqueEmail(`cancel-${status}`);
        // Create the customer constant.
        const customer = await signupCustomer(request, { email, password: PASSWORD });

        // Create the seeded constant.
        const seeded = await seedLinkedBooking({
          // Contribute this line to the enclosing declaration or statement.
          carId,
          // Contribute this line to the enclosing declaration or statement.
          status,
          // Provide the user id field value.
          userId: customer.userId,
          // Provide the pickup date field value.
          pickupDate: range.pickupDate,
          // Provide the return date field value.
          returnDate: range.returnDate,
          // Provide the guest field value.
          guest: { ...E2E_GUEST, email, fullName: `Terminal ${status}` },
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
        await expect(page.getByRole('button', { name: 'Request cancellation' })).toHaveCount(0);
        // Assert that the value matches the intended expectation.
        expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();

        // Create the res constant.
        const res = await apiPost(
          // Contribute this line to the enclosing declaration or statement.
          request,
          // Continue the surrounding logic with this statement.
          `/api/account/reservations/${seeded.reservationId}/cancel-request`,
          // Contribute this line to the enclosing declaration or statement.
          { reason: 'should fail' },
          // Contribute this line to the enclosing declaration or statement.
          customer.session
        );
        // Assert that the value matches the intended expectation.
        expect(res.status()).toBe(422);

        // Wait until the asynchronous operation resolves.
        await assertReservationStatus(seeded.reservationId, status);
        // Assert that the value matches the intended expectation.
        expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();
      });
    }
  });
});

// Call test.describe to perform this step.
test.describe("cancellation-approval", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cancel Approve ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Call test.describe to perform this step.
  test.describe('CROSS-001 Cancellation approved by admin', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 50, nights: 3 });

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
    test('customer request then admin approve cancels booking', async ({ page, request, adminPage }) => {
      // Create the email constant.
      const email = uniqueEmail('cancel-approve');
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
        guest: { ...E2E_GUEST, email, fullName: 'Cancel Approve Guest' },
      });

      // Wait until the asynchronous operation resolves.
      await applySessionCookies(page, customer.session);
      // Wait until the asynchronous operation resolves.
      await page.goto(`/account/reservations/${seeded.reservationId}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Reason (optional)').fill('E2E cancel approve');
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Request cancellation' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Cancellation request submitted for review')).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Assert that the value matches the intended expectation.
      expect(await getPendingCancellationRequest(seeded.reservationId)).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/reservations');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Cancellation requests' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByText to perform this step.
        adminPage.getByText(new RegExp(`Reservation #${seeded.reservationId}`))
      // Continue the surrounding logic with this statement.
      ).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Approve' }).first().click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Cancellation request updated')).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(seeded.reservationId, 'cancelled');
      // Create the latest constant.
      const latest = await getLatestCancellationRequest(seeded.reservationId);
      // Assert that the value matches the intended expectation.
      expect(latest?.status).toBe('approved');
      // Assert that the value matches the intended expectation.
      expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();
    });
  });
});

// Call test.describe to perform this step.
test.describe("cancellation-rejection", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Cancel Reject ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Call test.describe to perform this step.
  test.describe('CROSS-002 Cancellation rejected keeps booking', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 55, nights: 3 });

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
    test('admin reject leaves reservation confirmed in portal', async ({ page, request, adminPage }) => {
      // Create the email constant.
      const email = uniqueEmail('cancel-reject');
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
        guest: { ...E2E_GUEST, email, fullName: 'Cancel Reject Guest' },
      });

      // Wait until the asynchronous operation resolves.
      await applySessionCookies(page, customer.session);
      // Wait until the asynchronous operation resolves.
      await page.goto(`/account/reservations/${seeded.reservationId}`);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Reason (optional)').fill('E2E cancel reject');
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Request cancellation' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Cancellation request submitted for review')).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/reservations');
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call adminPage.getByText to perform this step.
        adminPage.getByText(new RegExp(`Reservation #${seeded.reservationId}`))
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Reject' }).first().click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Cancellation request updated')).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(seeded.reservationId, 'confirmed');
      // Create the latest constant.
      const latest = await getLatestCancellationRequest(seeded.reservationId);
      // Assert that the value matches the intended expectation.
      expect(latest?.status).toBe('rejected');
      // Assert that the value matches the intended expectation.
      expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();

      // Wait until the asynchronous operation resolves.
      await page.goto('/account/reservations');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(`Reservation #${seeded.reservationId}`)).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
    });
  });
});
