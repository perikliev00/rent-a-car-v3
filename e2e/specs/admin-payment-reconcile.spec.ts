// Import named exports from '../fixtures/base'.
import { test, expect } from '../fixtures/base';
// Import named exports from '../helpers/csrf'.
import { loginAsAdmin } from '../helpers/csrf';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures } from '../helpers/seed';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  getOrderByGuestEmail,
  // Contribute this line to the enclosing declaration or statement.
  getReservationByStripeSessionId,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/test-env'.
import { allocateFutureRange, E2E_GUEST, uniqueEmail } from '../helpers/test-env';
// Import named exports from '../helpers/booking'.
import { openOrderAndResolveConflict } from '../helpers/booking';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getPaymentsMonitorViaApi,
  // Contribute this line to the enclosing declaration or statement.
  markStubSessionPaid,
  // Contribute this line to the enclosing declaration or statement.
  reconcilePaymentsViaApi,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/payments';

// Create the car name constant.
const CAR_NAME = `E2E Payment Reconcile ${Date.now()}`;

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe('MONEY-010 Payments monitor + dry-run/live reconcile', () => {
  // Call test.setTimeout to perform this step.
  test.setTimeout(180_000);

  // Contribute this line to the enclosing declaration or statement.
  let carId: number;
  // Create the range constant.
  const range = allocateFutureRange({ fromDaysAhead: 145, nights: 3 });
  // Create the guest email constant.
  const guestEmail = uniqueEmail('reconcile');

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
    await cleanupReservationsForCar(carId);
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Call test.beforeEach to perform this step.
  test.beforeEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupReservationsForCar(carId);
  });

  // Define a single test case and its expectations.
  test('monitor + dry-run keeps processing; live finalizes after stub mark-paid', async ({
    // Contribute this line to the enclosing declaration or statement.
    page,
    // Contribute this line to the enclosing declaration or statement.
    adminPage,
    // Contribute this line to the enclosing declaration or statement.
    request,
  // Continue the surrounding logic with this statement.
  }) => {
    // Wait until the asynchronous operation resolves.
    await openOrderAndResolveConflict(page, carId, range);
    // Wait until the asynchronous operation resolves.
    await page.getByRole('button', { name: 'Continue to checkout' }).click();
    // Wait until the asynchronous operation resolves.
    await expect(page).toHaveURL(new RegExp(`/checkout/${carId}`));
    // Wait until the asynchronous operation resolves.
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Full name').fill('Reconcile Guest');
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Phone number').fill(E2E_GUEST.phoneNumber);
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Email').fill(guestEmail);
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Address').fill(E2E_GUEST.address);

    // Wait until the asynchronous operation resolves.
    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    // Wait until the asynchronous operation resolves.
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

    // Create the stripe session id constant.
    const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
    // Assert that the value matches the intended expectation.
    expect(stripeSessionId).toMatch(/^cs_test_/);

    // Initialize the mutable reservation variable.
    let reservation = await getReservationByStripeSessionId(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(reservation).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('processing_payment');

    // Leave success page so it cannot poll/finalize after stub mark-paid.
    await page.goto('/');

    // Create the session constant.
    const session = await loginAsAdmin(request);

    // Create the marked constant.
    const marked = await markStubSessionPaid(request, session, stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(marked.status, JSON.stringify(marked.body)).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(marked.body?.data?.paymentStatus || marked.body?.paymentStatus).toBe('paid');

    // Store the awaited result in reservation.
    reservation = await getReservationByStripeSessionId(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('processing_payment');

    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/payments');
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible({
      // Provide the timeout field value.
      timeout: 15_000,
    });
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(/unresolved failure/i)).toBeVisible();

    // Create the monitor constant.
    const monitor = await getPaymentsMonitorViaApi(request, session);
    // Assert that the value matches the intended expectation.
    expect(monitor.status).toBe(200);

    // Create the dry constant.
    const dry = await reconcilePaymentsViaApi(request, session, true);
    // Assert that the value matches the intended expectation.
    expect(dry.status, JSON.stringify(dry.body)).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(dry.body?.data?.dryRun ?? dry.body?.dryRun).toBe(true);

    // Store the awaited result in reservation.
    reservation = await getReservationByStripeSessionId(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(await getOrderByGuestEmail(guestEmail)).toBeFalsy();

    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/payments');
    // Wait until the asynchronous operation resolves.
    await adminPage.getByLabel('Dry run').uncheck();
    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('button', { name: 'Reconcile' }).click();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText('Reconcile completed')).toBeVisible({ timeout: 15_000 });

    // Store the awaited result in reservation.
    reservation = await getReservationByStripeSessionId(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('confirmed');

    // Create the order constant.
    const order = await getOrderByGuestEmail(guestEmail);
    // Assert that the value matches the intended expectation.
    expect(order).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(order.status).toBe('active');

    // Create the live constant.
    const live = await reconcilePaymentsViaApi(request, session, false);
    // Assert that the value matches the intended expectation.
    expect(live.status).toBe(200);

    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/payments');
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible({
      // Provide the timeout field value.
      timeout: 15_000,
    });
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText(stripeSessionId)).toHaveCount(0);
  });

  // Define a single test case and its expectations.
  test('live reconcile leaves unpaid stub session processing', async ({ page, request }) => {
    // Wait until the asynchronous operation resolves.
    await openOrderAndResolveConflict(page, carId, range);
    // Wait until the asynchronous operation resolves.
    await page.getByRole('button', { name: 'Continue to checkout' }).click();
    // Wait until the asynchronous operation resolves.
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

    // Create the unpaid email constant.
    const unpaidEmail = uniqueEmail('unpaid-rec');
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Full name').fill('Unpaid Guest');
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Phone number').fill(E2E_GUEST.phoneNumber);
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Email').fill(unpaidEmail);
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Address').fill(E2E_GUEST.address);

    // Wait until the asynchronous operation resolves.
    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    // Wait until the asynchronous operation resolves.
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

    // Create the stripe session id constant.
    const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
    // Assert that the value matches the intended expectation.
    expect(stripeSessionId).toMatch(/^cs_test_/);

    // Create the session constant.
    const session = await loginAsAdmin(request);
    // Create the live constant.
    const live = await reconcilePaymentsViaApi(request, session, false);
    // Assert that the value matches the intended expectation.
    expect(live.status, JSON.stringify(live.body)).toBe(200);

    // Create the reservation constant.
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(await getOrderByGuestEmail(unpaidEmail)).toBeFalsy();
  });
});
