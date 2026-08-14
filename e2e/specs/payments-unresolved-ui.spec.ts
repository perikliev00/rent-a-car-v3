import { test, expect } from '../fixtures/base';
import { loginAsAdmin } from '../helpers/csrf';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  getReservationByStripeSessionId,
} from '../helpers/db';
import { allocateFutureRange, E2E_GUEST, uniqueEmail } from '../helpers/test-env';
import { openOrderAndResolveConflict } from '../helpers/booking';
import { markStubSessionPaid, reconcilePaymentsViaApi } from '../helpers/payments';

const CAR_NAME = `E2E Pay Unresolved UI ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Payments unresolved UI (103)', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 150, nights: 2 });
  const guestEmail = uniqueEmail('pay-unresolved');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('Payments shows unresolved stuck session; reconcile clears it', async ({
    page,
    adminPage,
    request,
  }) => {
    await openOrderAndResolveConflict(page, carId, range);
    await page.getByRole('button', { name: 'Continue to checkout' }).click();
    await expect(page).toHaveURL(new RegExp(`/checkout/${carId}`));

    await page.getByLabel('Full name').fill('Unresolved UI Guest');
    await page.getByLabel('Phone number').fill(E2E_GUEST.phoneNumber);
    await page.getByLabel('Email').fill(guestEmail);
    await page.getByLabel('Address').fill(E2E_GUEST.address);

    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });
    const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
    expect(stripeSessionId).toMatch(/^cs_test_/);

    await page.goto('/');

    const session = await loginAsAdmin(request);
    const marked = await markStubSessionPaid(request, session, stripeSessionId);
    expect(marked.status, JSON.stringify(marked.body)).toBe(200);

    let reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation.status).toBe('processing_payment');

    await adminPage.goto('/admin/payments');
    await expect(adminPage.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByText(/unresolved failure/i)).toBeVisible();

    await adminPage.getByLabel('Dry run').uncheck();
    await adminPage.getByRole('button', { name: 'Reconcile' }).click();
    await expect(adminPage.getByText(/reconcile/i).first()).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        reservation = await getReservationByStripeSessionId(stripeSessionId);
        return reservation.status;
      }, { timeout: 30_000 })
      .toBe('confirmed');

    const live = await reconcilePaymentsViaApi(request, session, false);
    expect(live.status).toBe(200);

    await adminPage.goto('/admin/payments');
    await expect(adminPage.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    // Stuck row for this session should no longer appear as unresolved processing.
    await expect(adminPage.getByText(stripeSessionId)).toHaveCount(0);
  });
});
