import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getReservationByStripeSessionId,
  getOrderByGuestEmail,
  countDateBlocksForCar,
  eurosToStripeCents,
} from '../helpers/db';
import {
  allocateFutureRange,
  uniqueEmail,
  E2E_GUEST,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  API_URL,
} from '../helpers/test-env';
import {
  fillHomeSearch,
  openOrderAndResolveConflict,
  continueToCheckoutAndFillGuest,
} from '../helpers/booking';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
import { loginAsAdmin } from '../helpers/csrf';
import { markStubSessionPaid } from '../helpers/payments';

const CAR_NAME = `E2E Happy Path ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Booking happy path', () => {
  test.setTimeout(120_000);

  let carId: number;
  let stripeSessionId: string;
  const range = allocateFutureRange({ fromDaysAhead: 80, nights: 4 });
  const guestEmail = uniqueEmail('happy');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId);
  });

  test('guest can search, checkout, finalize via webhook, and admin sees the order', async ({
    page,
    request,
  }) => {
    await cleanupReservationsForCar(carId);

    await fillHomeSearch(page, range);
    await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });

    await openOrderAndResolveConflict(page, carId, range);
    await continueToCheckoutAndFillGuest(page, carId, {
      ...E2E_GUEST,
      email: guestEmail,
      hotelName: '',
    });

    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

    stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
    expect(stripeSessionId).toMatch(/^cs_test_/);

    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation).toBeTruthy();
    expect(reservation.status).toBe('processing_payment');

    const amountTotal = eurosToStripeCents(Number(reservation.total_price));
    const webhookEvent = buildCheckoutCompletedEvent({
      eventId: `evt_e2e_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId: reservation.car_id,
      sessionIdMeta: reservation.session_id,
      amountTotal,
    });

    const webhookRes = await postSignedWebhook(request, webhookEvent);
    expect(webhookRes.status()).toBe(200);
    expect(await webhookRes.json()).toEqual({ received: true });

    const confirmedReservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(confirmedReservation.status).toBe('confirmed');

    // Stub session stays unpaid until marked; success API requires payment_status=paid.
    const adminSession = await loginAsAdmin(request);
    const marked = await markStubSessionPaid(request, adminSession, stripeSessionId);
    expect(marked.status, JSON.stringify(marked.body)).toBe(200);

    const successApi = await request.get(
      `${API_URL}/api/v1/checkout/success?session_id=${stripeSessionId}`
    );
    expect(successApi.ok(), await successApi.text()).toBeTruthy();
    expect((await successApi.json()).data.title).toBe('Booking Confirmed');

    await page.goto(`/checkout/success?session_id=${stripeSessionId}`);
    await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toBeVisible({
      timeout: 15_000,
    });

    const order = await getOrderByGuestEmail(guestEmail);
    expect(order).toBeTruthy();
    expect(order.status).toBe('active');
    expect(await countDateBlocksForCar(carId)).toBe(1);

    await page.goto('/login');
    await page.getByLabel(/^email$/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL(/\/admin/);
    await page.goto('/admin/orders');
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(page.getByText(guestEmail)).toBeVisible();
    await expect(page.getByText(CAR_NAME)).toBeVisible();

    await page.getByRole('button', { name: 'View' }).first().click();
    await expect(page.getByRole('heading', { name: new RegExp(`Order #${order.id}`) })).toBeVisible();
    await expect(page.getByText(range.pickupDate)).toBeVisible();
    await expect(page.getByText(range.returnDate)).toBeVisible();
  });

  test('same dates become unavailable for a fresh guest session', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await fillHomeSearch(page, range);

      const carHeading = page.getByRole('heading', { name: CAR_NAME });
      const carVisible = await carHeading.isVisible().catch(() => false);

      if (carVisible) {
        await page.getByRole('link', { name: 'View details' }).first().click();
        await page.getByRole('button', { name: 'Book this car' }).click();
        await expect(page).toHaveURL(new RegExp(`/order/${carId}`));
        await expect(page.getByText(/already booked|already reserved/i)).toBeVisible({
          timeout: 15_000,
        });
      } else {
        await expect(carHeading).not.toBeVisible();
      }
    } finally {
      await context.close();
    }
  });
});
