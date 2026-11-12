// Import named exports from '../fixtures/base'.
import { test, expect } from '../fixtures/base';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/account'.
import { signupCustomer } from '../helpers/account';
// Import named exports from '../helpers/test-env'.
import { allocateFutureRange, API_URL, E2E_GUEST, uniqueEmail } from '../helpers/test-env';
// Import named exports from '../helpers/admin-reservations'.
import { changeOpsStatusViaApi } from '../helpers/admin-reservations';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  expectUrlUnchanged,
  // Contribute this line to the enclosing declaration or statement.
  waitForAdminLive,
  // Contribute this line to the enclosing declaration or statement.
  waitForAdminRealtimeToast,
  // Contribute this line to the enclosing declaration or statement.
  waitForAdminSseEvent,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/admin-realtime';

// Create the car name constant.
const CAR_NAME = `E2E Realtime ${Date.now()}`;
// Browser EventSource.OPEN. The Playwright worker process has no EventSource global.
const SSE_OPEN = 1;

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe('CROSS-004 Admin realtime updates without reload', () => {
  // Call test.setTimeout to perform this step.
  test.setTimeout(180_000);

  // Contribute this line to the enclosing declaration or statement.
  let carId: number;
  // Create the range constant.
  const range = allocateFutureRange({ fromDaysAhead: 150, nights: 2 });

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
  test('Live SSE + car_returned toast without page reload', async ({ adminPage, request }) => {
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
      guest: { ...E2E_GUEST, email: uniqueEmail('realtime'), fullName: 'Realtime Guest' },
    });

    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/orders');
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible({
      // Provide the timeout field value.
      timeout: 15_000,
    });
    // Wait until the asynchronous operation resolves.
    await waitForAdminLive(adminPage);

    // Create the url before constant.
    const urlBefore = adminPage.url();

    // Walk ops path to a high-signal status (returned → car_returned).
    for (const status of ['car_prepared', 'picked_up', 'active_rental'] as const) {
      // Create the step constant.
      const step = await changeOpsStatusViaApi(request, seeded.reservationId, status);
      // Assert that the value matches the intended expectation.
      expect(step.ok, JSON.stringify(step.body)).toBeTruthy();
    }

    // Create the sse payload constant.
    const ssePayload = waitForAdminSseEvent(adminPage, {
      // Provide the type field value.
      type: 'car_returned',
      // Provide the timeout ms field value.
      timeoutMs: 30_000,
      // Provide the trigger field value.
      trigger: async () => {
        // Create the result constant.
        const result = await changeOpsStatusViaApi(request, seeded.reservationId, 'returned');
        // Assert that the value matches the intended expectation.
        expect(result.ok, JSON.stringify(result.body)).toBeTruthy();
      },
    });

    // Wait until the asynchronous operation resolves.
    await expectUrlUnchanged(adminPage, async () => {
      // Wait until the asynchronous operation resolves.
      await waitForAdminRealtimeToast(adminPage, /Car returned/i, 30_000);
    });

    // Create the payload constant.
    const payload = await ssePayload;
    // Assert that the value matches the intended expectation.
    expect(payload).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(String(payload.type || 'car_returned')).toMatch(/car_returned/);
    // Assert that the value matches the intended expectation.
    expect(adminPage.url()).toBe(urlBefore);
  });

  // Define a single test case and its expectations.
  test('admin SSE ends on logout and a customer cannot open the staff stream', async ({
    // Contribute this line to the enclosing declaration or statement.
    adminPage,
    // Contribute this line to the enclosing declaration or statement.
    request,
  // Continue the surrounding logic with this statement.
  }) => {
    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/orders');
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible({
      // Provide the timeout field value.
      timeout: 15_000,
    });

    // Create the stream url constant.
    const streamUrl = `${API_URL}/api/v1/admin/realtime/stream`;
    // Wait until the asynchronous operation resolves.
    await adminPage.evaluate((url) => {
      // Create the w constant.
      const w = window as unknown as {
        // Contribute this line to the enclosing declaration or statement.
        __sseReason?: string | null;
        // Contribute this line to the enclosing declaration or statement.
        __sseSource?: EventSource;
      };
      // Update w.__sseReason with the right-hand side value.
      w.__sseReason = null;
      // Create the source constant.
      const source = new EventSource(url, { withCredentials: true });
      // Update w.__sseSource with the right-hand side value.
      w.__sseSource = source;
      // Call source.addEventListener to perform this step.
      source.addEventListener('session_revoked', (evt) => {
        // Start a try block for operations that may fail.
        try {
          // Update w.__sseReason with the right-hand side value.
          w.__sseReason = String(JSON.parse((evt as MessageEvent).data).reason || '');
        // Contribute this line to the enclosing declaration or statement.
        } catch {
          // Update w.__sseReason with the right-hand side value.
          w.__sseReason = 'unparsed';
        }
      });
    // Continue the surrounding logic with this statement.
    }, streamUrl);

    // Wait until the asynchronous operation resolves.
    await expect
      // Call .poll to perform this step.
      .poll(
        // Continue the surrounding logic with this statement.
        () =>
          // Call adminPage.evaluate to perform this step.
          adminPage.evaluate(() => {
            // Create the source constant.
            const source = (window as unknown as { __sseSource?: EventSource }).__sseSource;
            // Return the resulting value to the caller.
            return source ? source.readyState : -1;
          }),
        // Contribute this line to the enclosing declaration or statement.
        { timeout: 15_000 }
      )
      // Call .toBe to perform this step.
      .toBe(SSE_OPEN);

    // Create the logout status constant.
    const logoutStatus = await adminPage.evaluate(async (apiUrl) => {
      // Create the csrf res constant.
      const csrfRes = await fetch(`${apiUrl}/api/v1/auth/csrf`, { credentials: 'include' });
      // Create the csrf constant.
      const csrf = await csrfRes.json();
      // Create the token constant.
      const token = csrf?.data?.csrfToken;
      // Create the res constant.
      const res = await fetch(`${apiUrl}/api/v1/auth/logout`, {
        // Provide the method field value.
        method: 'POST',
        // Provide the credentials field value.
        credentials: 'include',
        // Provide the headers field value.
        headers: { 'X-CSRF-Token': token },
      });
      // Return the resulting value to the caller.
      return res.status;
    // Continue the surrounding logic with this statement.
    }, API_URL);
    // Assert that the value matches the intended expectation.
    expect(logoutStatus).toBe(200);

    // Wait until the asynchronous operation resolves.
    await expect
      // Call .poll to perform this step.
      .poll(
        // Continue the surrounding logic with this statement.
        () =>
          // Call adminPage.evaluate to perform this step.
          adminPage.evaluate(
            // Continue the surrounding logic with this statement.
            () => (window as unknown as { __sseReason?: string | null }).__sseReason ?? null
          ),
        // Contribute this line to the enclosing declaration or statement.
        { timeout: 10_000 }
      )
      // Call .toBe to perform this step.
      .toBe('logout');

    // Create the customer constant.
    const customer = await signupCustomer(request, {
      // Provide the email field value.
      email: uniqueEmail('sse-customer'),
      // Provide the password field value.
      password: 'Customer123!',
    });
    // Create the denied constant.
    const denied = await request.get(streamUrl, {
      // Provide the headers field value.
      headers: { Cookie: customer.session.cookieHeader },
    });
    // Assert that the value matches the intended expectation.
    expect(denied.status(), await denied.text()).toBe(403);
  });
});
