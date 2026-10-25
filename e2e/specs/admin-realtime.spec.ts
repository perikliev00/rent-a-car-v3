import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
} from '../helpers/db';
import { signupCustomer } from '../helpers/account';
import { allocateFutureRange, API_URL, E2E_GUEST, uniqueEmail } from '../helpers/test-env';
import { changeOpsStatusViaApi } from '../helpers/admin-reservations';
import {
  expectUrlUnchanged,
  waitForAdminLive,
  waitForAdminRealtimeToast,
  waitForAdminSseEvent,
} from '../helpers/admin-realtime';

const CAR_NAME = `E2E Realtime ${Date.now()}`;
// Browser EventSource.OPEN. The Playwright worker process has no EventSource global.
const SSE_OPEN = 1;

test.describe.configure({ mode: 'serial' });

test.describe('CROSS-004 Admin realtime updates without reload', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 150, nights: 2 });

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

  test('Live SSE + car_returned toast without page reload', async ({ adminPage, request }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      guest: { ...E2E_GUEST, email: uniqueEmail('realtime'), fullName: 'Realtime Guest' },
    });

    await adminPage.goto('/admin/orders');
    await expect(adminPage.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await waitForAdminLive(adminPage);

    const urlBefore = adminPage.url();

    // Walk ops path to a high-signal status (returned → car_returned).
    for (const status of ['car_prepared', 'picked_up', 'active_rental'] as const) {
      const step = await changeOpsStatusViaApi(request, seeded.reservationId, status);
      expect(step.ok, JSON.stringify(step.body)).toBeTruthy();
    }

    const ssePayload = waitForAdminSseEvent(adminPage, {
      type: 'car_returned',
      timeoutMs: 30_000,
      trigger: async () => {
        const result = await changeOpsStatusViaApi(request, seeded.reservationId, 'returned');
        expect(result.ok, JSON.stringify(result.body)).toBeTruthy();
      },
    });

    await expectUrlUnchanged(adminPage, async () => {
      await waitForAdminRealtimeToast(adminPage, /Car returned/i, 30_000);
    });

    const payload = await ssePayload;
    expect(payload).toBeTruthy();
    expect(String(payload.type || 'car_returned')).toMatch(/car_returned/);
    expect(adminPage.url()).toBe(urlBefore);
  });

  test('admin SSE ends on logout and a customer cannot open the staff stream', async ({
    adminPage,
    request,
  }) => {
    await adminPage.goto('/admin/orders');
    await expect(adminPage.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const streamUrl = `${API_URL}/api/v1/admin/realtime/stream`;
    await adminPage.evaluate((url) => {
      const w = window as unknown as {
        __sseReason?: string | null;
        __sseSource?: EventSource;
      };
      w.__sseReason = null;
      const source = new EventSource(url, { withCredentials: true });
      w.__sseSource = source;
      source.addEventListener('session_revoked', (evt) => {
        try {
          w.__sseReason = String(JSON.parse((evt as MessageEvent).data).reason || '');
        } catch {
          w.__sseReason = 'unparsed';
        }
      });
    }, streamUrl);

    await expect
      .poll(
        () =>
          adminPage.evaluate(() => {
            const source = (window as unknown as { __sseSource?: EventSource }).__sseSource;
            return source ? source.readyState : -1;
          }),
        { timeout: 15_000 }
      )
      .toBe(SSE_OPEN);

    const logoutStatus = await adminPage.evaluate(async (apiUrl) => {
      const csrfRes = await fetch(`${apiUrl}/api/v1/auth/csrf`, { credentials: 'include' });
      const csrf = await csrfRes.json();
      const token = csrf?.data?.csrfToken;
      const res = await fetch(`${apiUrl}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': token },
      });
      return res.status;
    }, API_URL);
    expect(logoutStatus).toBe(200);

    await expect
      .poll(
        () =>
          adminPage.evaluate(
            () => (window as unknown as { __sseReason?: string | null }).__sseReason ?? null
          ),
        { timeout: 10_000 }
      )
      .toBe('logout');

    const customer = await signupCustomer(request, {
      email: uniqueEmail('sse-customer'),
      password: 'Customer123!',
    });
    const denied = await request.get(streamUrl, {
      headers: { Cookie: customer.session.cookieHeader },
    });
    expect(denied.status(), await denied.text()).toBe(403);
  });
});
