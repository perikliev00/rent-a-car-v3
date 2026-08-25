import { expect, test } from '@playwright/test';
import {
  applySessionCookies,
  createOwnedHoldViaApi,
  signupVerifiedCustomer,
} from '../helpers/account';
import { continueToCheckoutAndFillGuest, fillHomeSearch, openOrderAndResolveConflict } from '../helpers/booking';
import { loginAsAdmin } from '../helpers/csrf';
import {
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  countDateBlocksForCar,
  eurosToStripeCents,
  getOrderByGuestEmail,
  getReservationByStripeSessionId,
  getReservationUserId,
  withDb,
} from '../helpers/db';
import { markStubSessionPaid } from '../helpers/payments';
import { seedE2eFixtures } from '../helpers/seed';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  API_URL,
  E2E_GUEST,
  allocateFutureRange,
  uniqueEmail,
} from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("booking-happy-path", () => {
  const CAR_NAME = `E2E Happy Path ${Date.now()}`;

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
          await page.getByRole('link', { name: /^View$/ }).first().click();
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
});

test.describe("customer-booking", () => {
  const CAR_NAME = `E2E Customer Booking ${Date.now()}`;
  const PASSWORD = 'Customer123!';

  async function findLatestReservationForUser(userId: number) {
    return withDb(async (client) => {
      const result = await client.query(
        `
        SELECT id, status, user_id, email
        FROM reservations
        WHERE user_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [userId]
      );
      return result.rows[0] || null;
    });
  }

  test.describe('CUST-002 Logged-in customer booking appears in portal', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 60, nights: 3 });

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

    test('authenticated order hold shows on account dashboard', async ({ page, request }) => {
      const email = uniqueEmail('cust-book');
      const customer = await signupVerifiedCustomer(request, { email, password: PASSWORD });

      await createOwnedHoldViaApi(request, customer.session, {
        carId,
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        pickupLocation: 'office',
        returnLocation: 'office',
        fullName: E2E_GUEST.fullName,
        phoneNumber: E2E_GUEST.phoneNumber,
        email,
        address: E2E_GUEST.address,
        hotelName: E2E_GUEST.hotelName,
      });

      const reservation = await findLatestReservationForUser(customer.userId);
      expect(reservation).toBeTruthy();
      expect(reservation.status).toBe('pending_payment');
      expect(await getReservationUserId(Number(reservation.id))).toBe(customer.userId);

      await applySessionCookies(page, customer.session);
      await page.goto('/account/reservations');
      await expect(page.getByRole('heading', { name: 'My reservations' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(`Reservation #${reservation.id}`)).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});

test.describe("customer-pay-portal", () => {
  const CAR_NAME = `E2E Portal Pay ${Date.now()}`;
  const PASSWORD = 'Customer123!';

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
      const customer = await signupVerifiedCustomer(request, { email, password: PASSWORD });
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
});
