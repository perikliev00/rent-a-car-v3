import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getReservationByStripeSessionId,
  getReservationUserId,
  eurosToStripeCents,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST, API_URL } from '../helpers/test-env';
import {
  openOrderAndResolveConflict,
  continueToCheckoutAndFillGuest,
} from '../helpers/booking';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
import { signupCustomer, applySessionCookies } from '../helpers/account';
import { loginAsAdmin } from '../helpers/csrf';
import { markStubSessionPaid } from '../helpers/payments';

const CAR_NAME = `E2E Portal Pay ${Date.now()}`;
const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('Logged-in customer pay-through (89)', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 240, nights: 3 });

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('customer books to confirmed and sees portal reservation + PDFs', async ({
    page,
    request,
  }) => {
    await cleanupReservationsForCar(carId);
    const email = uniqueEmail('portal-pay');
    const customer = await signupCustomer(request, { email, password: PASSWORD });
    await applySessionCookies(page, customer.session);
    const pairs = customer.session.cookieHeader
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((pair) => {
        const eq = pair.indexOf('=');
        return {
          name: eq > 0 ? pair.slice(0, eq) : pair,
          value: eq > 0 ? pair.slice(eq + 1) : '',
          url: API_URL,
        };
      });
    if (pairs.length) await page.context().addCookies(pairs);

    await openOrderAndResolveConflict(page, carId, range);
    await continueToCheckoutAndFillGuest(page, carId, {
      ...E2E_GUEST,
      email,
      hotelName: '',
    });
    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

    const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation).toBeTruthy();
    expect(await getReservationUserId(Number(reservation.id))).toBe(customer.userId);

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_e2e_portal_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId: reservation.car_id,
      sessionIdMeta: reservation.session_id,
      amountTotal: eurosToStripeCents(Number(reservation.total_price)),
    });
    expect((await postSignedWebhook(request, event)).status()).toBe(200);

    const adminSession = await loginAsAdmin(request);
    await markStubSessionPaid(request, adminSession, stripeSessionId);

    const confirmed = await getReservationByStripeSessionId(stripeSessionId);
    expect(confirmed.status).toBe('confirmed');
    expect(await getReservationUserId(Number(confirmed.id))).toBe(customer.userId);

    await page.goto('/account/reservations');
    await expect(page.getByRole('heading', { name: 'My reservations' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/confirmed/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(String(confirmed.id)).first()).toBeVisible();

    await page.goto(`/account/reservations/${confirmed.id}`);
    await expect(
      page.getByRole('heading', { name: `Reservation #${confirmed.id}` })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/confirmed/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Documents (PDF)' })).toBeVisible();
    for (const label of ['Rental agreement', 'Invoice', 'Receipt']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
    await expect(page.getByLabel('Flight number')).toBeVisible();
  });
});
