// Import named exports from '@playwright/test'.
import { expect, test } from '@playwright/test';
// Import named exports from '../helpers/account'.
import { applySessionCookies, createOwnedHoldViaApi, signupCustomer } from '../helpers/account';
// Import named exports from '../helpers/booking'.
import { continueToCheckoutAndFillGuest, fillHomeSearch, openOrderAndResolveConflict } from '../helpers/booking';
// Import named exports from '../helpers/csrf'.
import { loginAsAdmin } from '../helpers/csrf';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  countDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  eurosToStripeCents,
  // Contribute this line to the enclosing declaration or statement.
  getOrderByGuestEmail,
  // Contribute this line to the enclosing declaration or statement.
  getReservationByStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  getReservationUserId,
  // Contribute this line to the enclosing declaration or statement.
  withDb,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/payments'.
import { markStubSessionPaid } from '../helpers/payments';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures } from '../helpers/seed';
// Import named exports from '../helpers/stripe-webhook'.
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  ADMIN_EMAIL,
  // Contribute this line to the enclosing declaration or statement.
  ADMIN_PASSWORD,
  // Contribute this line to the enclosing declaration or statement.
  ADMIN_BASE_URL,
  // Contribute this line to the enclosing declaration or statement.
  API_URL,
  // Contribute this line to the enclosing declaration or statement.
  E2E_GUEST,
  // Contribute this line to the enclosing declaration or statement.
  allocateFutureRange,
  // Contribute this line to the enclosing declaration or statement.
  uniqueEmail,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("booking-happy-path", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Happy Path ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Booking happy path', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Contribute this line to the enclosing declaration or statement.
    let stripeSessionId: string;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 80, nights: 4 });
    // Create the guest email constant.
    const guestEmail = uniqueEmail('happy');

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
      await cleanupTestCar(carId);
    });

    // Define a single test case and its expectations.
    test('guest can search, checkout, finalize via webhook, and admin sees the order', async ({
      // Contribute this line to the enclosing declaration or statement.
      page,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);

      // Wait until the asynchronous operation resolves.
      await fillHomeSearch(page, range);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await openOrderAndResolveConflict(page, carId, range);
      // Wait until the asynchronous operation resolves.
      await continueToCheckoutAndFillGuest(page, carId, {
        // Spread E2E_GUEST into the surrounding structure.
        ...E2E_GUEST,
        // Provide the email field value.
        email: guestEmail,
        // Provide the hotel name field value.
        hotelName: '',
      });

      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Pay with Stripe' }).click();
      // Wait until the asynchronous operation resolves.
      await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

      // Update stripeSessionId with the right-hand side value.
      stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
      // Assert that the value matches the intended expectation.
      expect(stripeSessionId).toMatch(/^cs_test_/);

      // Create the reservation constant.
      const reservation = await getReservationByStripeSessionId(stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(reservation).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(reservation.status).toBe('processing_payment');

      // Create the amount total constant.
      const amountTotal = eurosToStripeCents(Number(reservation.total_price));
      // Create the webhook event constant.
      const webhookEvent = buildCheckoutCompletedEvent({
        // Provide the event id field value.
        eventId: `evt_e2e_${Date.now()}`,
        // Provide the session id field value.
        sessionId: stripeSessionId,
        // Provide the reservation id field value.
        reservationId: reservation.id,
        // Provide the car id field value.
        carId: reservation.car_id,
        // Provide the session id meta field value.
        sessionIdMeta: reservation.session_id,
        // Contribute this line to the enclosing declaration or statement.
        amountTotal,
      });

      // Create the webhook res constant.
      const webhookRes = await postSignedWebhook(request, webhookEvent);
      // Assert that the value matches the intended expectation.
      expect(webhookRes.status()).toBe(200);
      // Assert that the value matches the intended expectation.
      expect(await webhookRes.json()).toEqual({ received: true });

      // Create the confirmed reservation constant.
      const confirmedReservation = await getReservationByStripeSessionId(stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(confirmedReservation.status).toBe('confirmed');

      // Stub session stays unpaid until marked; success API requires payment_status=paid.
      const adminSession = await loginAsAdmin(request);
      // Create the marked constant.
      const marked = await markStubSessionPaid(request, adminSession, stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(marked.status, JSON.stringify(marked.body)).toBe(200);

      // Create the success api constant.
      const successApi = await request.get(
        // Continue the surrounding logic with this statement.
        `${API_URL}/api/v1/checkout/success?session_id=${stripeSessionId}`
      );
      // Assert that the value matches the intended expectation.
      expect(successApi.ok(), await successApi.text()).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect((await successApi.json()).data.title).toBe('Booking Confirmed');

      // Wait until the asynchronous operation resolves.
      await page.goto(`/checkout/success?session_id=${stripeSessionId}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Create the order constant.
      const order = await getOrderByGuestEmail(guestEmail);
      // Assert that the value matches the intended expectation.
      expect(order).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(order.status).toBe('active');
      // Assert that the value matches the intended expectation.
      expect(await countDateBlocksForCar(carId)).toBe(1);

      // Wait until the asynchronous operation resolves.
      await page.goto(`${ADMIN_BASE_URL}/login`);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel(/^email$/i).fill(ADMIN_EMAIL);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD);
      // Wait until the asynchronous operation resolves.
      await page.locator('form').getByRole('button', { name: 'Log in' }).click();
      // Wait until the asynchronous operation resolves.
      await page.waitForURL(/\/admin/);
      // Wait until the asynchronous operation resolves.
      await page.goto(`${ADMIN_BASE_URL}/admin/orders`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(guestEmail)).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(CAR_NAME)).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'View' }).first().click();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: new RegExp(`Order #${order.id}`) })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(range.pickupDate)).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(range.returnDate)).toBeVisible();
    });

    // Define a single test case and its expectations.
    test('same dates become unavailable for a fresh guest session', async ({ browser }) => {
      // Create the context constant.
      const context = await browser.newContext();
      // Create the page constant.
      const page = await context.newPage();

      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await fillHomeSearch(page, range);

        // Create the car heading constant.
        const carHeading = page.getByRole('heading', { name: CAR_NAME });
        // Create the car visible constant.
        const carVisible = await carHeading.isVisible().catch(() => false);

        // Evaluate the condition and enter the branch when it is true.
        if (carVisible) {
          // Wait until the asynchronous operation resolves.
          await page.getByRole('link', { name: /^View$/ }).first().click();
          // Wait until the asynchronous operation resolves.
          await page.getByRole('button', { name: 'Book this car' }).click();
          // Wait until the asynchronous operation resolves.
          await expect(page).toHaveURL(new RegExp(`/order/${carId}`));
          // Wait until the asynchronous operation resolves.
          await expect(page.getByText(/already booked|already reserved/i)).toBeVisible({
            // Provide the timeout field value.
            timeout: 15_000,
          });
        // Contribute this line to the enclosing declaration or statement.
        } else {
          // Wait until the asynchronous operation resolves.
          await expect(carHeading).not.toBeVisible();
        }
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Wait until the asynchronous operation resolves.
        await context.close();
      }
    });
  });
});

// Call test.describe to perform this step.
test.describe("customer-booking", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Customer Booking ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Define the async function findLatestReservationForUser.
  async function findLatestReservationForUser(userId: number) {
    // Return the resulting value to the caller.
    return withDb(async (client) => {
      // Create the result constant.
      const result = await client.query(
        // Continue the surrounding logic with this statement.
        `
        SELECT id, status, user_id, email
        FROM reservations
        WHERE user_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        // Contribute this line to the enclosing declaration or statement.
        [userId]
      );
      // Return the resulting value to the caller.
      return result.rows[0] || null;
    });
  }

  // Call test.describe to perform this step.
  test.describe('CUST-002 Logged-in customer booking appears in portal', () => {
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
      await cleanupTestCar(carId);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('authenticated order hold shows on account dashboard', async ({ page, request }) => {
      // Create the email constant.
      const email = uniqueEmail('cust-book');
      // Create the customer constant.
      const customer = await signupCustomer(request, { email, password: PASSWORD });

      // Wait until the asynchronous operation resolves.
      await createOwnedHoldViaApi(request, customer.session, {
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the full name field value.
        fullName: E2E_GUEST.fullName,
        // Provide the phone number field value.
        phoneNumber: E2E_GUEST.phoneNumber,
        // Contribute this line to the enclosing declaration or statement.
        email,
        // Provide the address field value.
        address: E2E_GUEST.address,
        // Provide the hotel name field value.
        hotelName: E2E_GUEST.hotelName,
      });

      // Create the reservation constant.
      const reservation = await findLatestReservationForUser(customer.userId);
      // Assert that the value matches the intended expectation.
      expect(reservation).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(reservation.status).toBe('pending_payment');
      // Assert that the value matches the intended expectation.
      expect(await getReservationUserId(Number(reservation.id))).toBe(customer.userId);

      // Wait until the asynchronous operation resolves.
      await applySessionCookies(page, customer.session);
      // Wait until the asynchronous operation resolves.
      await page.goto('/account/reservations');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'My reservations' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(`Reservation #${reservation.id}`)).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
    });
  });
});

// Call test.describe to perform this step.
test.describe("customer-pay-portal", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Portal Pay ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Call test.describe to perform this step.
  test.describe('Logged-in customer pay-through (89)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 240, nights: 3 });

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

    // Define a single test case and its expectations.
    test('customer books to confirmed and sees portal reservation + PDFs', async ({
      // Contribute this line to the enclosing declaration or statement.
      page,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
      // Create the email constant.
      const email = uniqueEmail('portal-pay');
      // Create the customer constant.
      const customer = await signupCustomer(request, { email, password: PASSWORD });
      // Wait until the asynchronous operation resolves.
      await applySessionCookies(page, customer.session);
      // Create the pairs constant.
      const pairs = customer.session.cookieHeader
        // Call .split to perform this step.
        .split(';')
        // Call .map to perform this step.
        .map((p) => p.trim())
        // Call .filter to perform this step.
        .filter(Boolean)
        // Call .map to perform this step.
        .map((pair) => {
          // Create the eq constant.
          const eq = pair.indexOf('=');
          // Return the resulting value to the caller.
          return {
            // Provide the name field value.
            name: eq > 0 ? pair.slice(0, eq) : pair,
            // Provide the value field value.
            value: eq > 0 ? pair.slice(eq + 1) : '',
            // Provide the url field value.
            url: API_URL,
          };
        });
      // Evaluate the condition and enter the branch when it is true.
      if (pairs.length) await page.context().addCookies(pairs);

      // Wait until the asynchronous operation resolves.
      await openOrderAndResolveConflict(page, carId, range);
      // Wait until the asynchronous operation resolves.
      await continueToCheckoutAndFillGuest(page, carId, {
        // Spread E2E_GUEST into the surrounding structure.
        ...E2E_GUEST,
        // Contribute this line to the enclosing declaration or statement.
        email,
        // Provide the hotel name field value.
        hotelName: '',
      });
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Pay with Stripe' }).click();
      // Wait until the asynchronous operation resolves.
      await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

      // Create the stripe session id constant.
      const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
      // Create the reservation constant.
      const reservation = await getReservationByStripeSessionId(stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(reservation).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(await getReservationUserId(Number(reservation.id))).toBe(customer.userId);

      // Create the event constant.
      const event = buildCheckoutCompletedEvent({
        // Provide the event id field value.
        eventId: `evt_e2e_portal_${Date.now()}`,
        // Provide the session id field value.
        sessionId: stripeSessionId,
        // Provide the reservation id field value.
        reservationId: reservation.id,
        // Provide the car id field value.
        carId: reservation.car_id,
        // Provide the session id meta field value.
        sessionIdMeta: reservation.session_id,
        // Provide the amount total field value.
        amountTotal: eurosToStripeCents(Number(reservation.total_price)),
      });
      // Assert that the value matches the intended expectation.
      expect((await postSignedWebhook(request, event)).status()).toBe(200);

      // Create the admin session constant.
      const adminSession = await loginAsAdmin(request);
      // Wait until the asynchronous operation resolves.
      await markStubSessionPaid(request, adminSession, stripeSessionId);

      // Create the confirmed constant.
      const confirmed = await getReservationByStripeSessionId(stripeSessionId);
      // Assert that the value matches the intended expectation.
      expect(confirmed.status).toBe('confirmed');
      // Assert that the value matches the intended expectation.
      expect(await getReservationUserId(Number(confirmed.id))).toBe(customer.userId);

      // Wait until the asynchronous operation resolves.
      await page.goto('/account/reservations');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'My reservations' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(/confirmed/i).first()).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(String(confirmed.id)).first()).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await page.goto(`/account/reservations/${confirmed.id}`);
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call page.getByRole to perform this step.
        page.getByRole('heading', { name: `Reservation #${confirmed.id}` })
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(/confirmed/i).first()).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Documents (PDF)' })).toBeVisible();
      // Iterate using the loop initializer, condition, and step.
      for (const label of ['Rental agreement', 'Invoice', 'Receipt']) {
        // Wait until the asynchronous operation resolves.
        await expect(page.getByRole('button', { name: label })).toBeVisible();
      }
      // Wait until the asynchronous operation resolves.
      await expect(page.getByLabel('Flight number')).toBeVisible();
    });
  });
});
