import { test, expect } from '../fixtures/base';
import { loginAsAdmin } from '../helpers/csrf';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  getOrderByGuestEmail,
  getReservationByStripeSessionId,
} from '../helpers/db';
import { allocateFutureRange, E2E_GUEST, uniqueEmail } from '../helpers/test-env';
import { openOrderAndResolveConflict } from '../helpers/booking';
import {
  getPaymentsMonitorViaApi,
  markStubSessionPaid,
  reconcilePaymentsViaApi,
} from '../helpers/payments';

const CAR_NAME = `E2E Payment Reconcile ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('MONEY-010 Payments monitor + dry-run/live reconcile', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 145, nights: 3 });
  const guestEmail = uniqueEmail('reconcile');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId);
    await cleanupTestCar(carId);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('monitor + dry-run keeps processing; live finalizes after stub mark-paid', async ({
    page,
    adminPage,
    request,
  }) => {
    await openOrderAndResolveConflict(page, carId, range);
    await page.getByRole('button', { name: 'Continue to checkout' }).click();
    await expect(page).toHaveURL(new RegExp(`/checkout/${carId}`));
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

    await page.getByLabel('Full name').fill('Reconcile Guest');
    await page.getByLabel('Phone number').fill(E2E_GUEST.phoneNumber);
    await page.getByLabel('Email').fill(guestEmail);
    await page.getByLabel('Address').fill(E2E_GUEST.address);

    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

    const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
    expect(stripeSessionId).toMatch(/^cs_test_/);

    let reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation).toBeTruthy();
    expect(reservation.status).toBe('processing_payment');

    // Leave success page so it cannot poll/finalize after stub mark-paid.
    await page.goto('/');

    const session = await loginAsAdmin(request);

    const marked = await markStubSessionPaid(request, session, stripeSessionId);
    expect(marked.status, JSON.stringify(marked.body)).toBe(200);
    expect(marked.body?.data?.paymentStatus || marked.body?.paymentStatus).toBe('paid');

    reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation.status).toBe('processing_payment');

    await adminPage.goto('/admin/payments');
    await expect(adminPage.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByText(/unresolved failure/i)).toBeVisible();

    const monitor = await getPaymentsMonitorViaApi(request, session);
    expect(monitor.status).toBe(200);

    const dry = await reconcilePaymentsViaApi(request, session, true);
    expect(dry.status, JSON.stringify(dry.body)).toBe(200);
    expect(dry.body?.data?.dryRun ?? dry.body?.dryRun).toBe(true);

    reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation.status).toBe('processing_payment');
    expect(await getOrderByGuestEmail(guestEmail)).toBeFalsy();

    await adminPage.goto('/admin/payments');
    await adminPage.getByLabel('Dry run').uncheck();
    await adminPage.getByRole('button', { name: 'Reconcile' }).click();
    await expect(adminPage.getByText('Reconcile completed')).toBeVisible({ timeout: 15_000 });

    reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation.status).toBe('confirmed');

    const order = await getOrderByGuestEmail(guestEmail);
    expect(order).toBeTruthy();
    expect(order.status).toBe('active');
  });

  test('live reconcile leaves unpaid stub session processing', async ({ page, request }) => {
    await openOrderAndResolveConflict(page, carId, range);
    await page.getByRole('button', { name: 'Continue to checkout' }).click();
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

    const unpaidEmail = uniqueEmail('unpaid-rec');
    await page.getByLabel('Full name').fill('Unpaid Guest');
    await page.getByLabel('Phone number').fill(E2E_GUEST.phoneNumber);
    await page.getByLabel('Email').fill(unpaidEmail);
    await page.getByLabel('Address').fill(E2E_GUEST.address);

    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

    const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
    expect(stripeSessionId).toMatch(/^cs_test_/);

    const session = await loginAsAdmin(request);
    const live = await reconcilePaymentsViaApi(request, session, false);
    expect(live.status, JSON.stringify(live.body)).toBe(200);

    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation.status).toBe('processing_payment');
    expect(await getOrderByGuestEmail(unpaidEmail)).toBeFalsy();
  });
});
