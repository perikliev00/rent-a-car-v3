import { test, expect } from '../fixtures/base';
import { loginAsAdmin, apiGet } from '../helpers/csrf';
import { insertTestStaff, loginAsStaff, cleanupTestStaff } from '../helpers/rbac';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
} from '../helpers/db';
import { allocateFutureRange, API_URL, E2E_GUEST, uniqueEmail } from '../helpers/test-env';
import { parseCsv } from '../helpers/csv';

const CAR_NAME = `E2E Analytics ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-023 Analytics + CSV real aggregates', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 2, nights: 3 });
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 30);
  const toDate = new Date(now);
  toDate.setUTCDate(toDate.getUTCDate() + 30);
  const from = fromDate.toISOString().slice(0, 10);
  const to = toDate.toISOString().slice(0, 10);

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

  test('overview KPIs + CSV export; export forbidden without permission', async ({
    adminPage,
    request,
  }) => {
    await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      guest: { ...E2E_GUEST, email: uniqueEmail('analytics'), fullName: 'Analytics Guest' },
      totalPrice: 220,
    });

    const session = await loginAsAdmin(request);
    const overview = await apiGet(
      request,
      `/api/admin/analytics/overview?from=${from}&to=${to}`,
      session
    );
    expect(overview.ok(), await overview.text()).toBeTruthy();
    const overviewBody = await overview.json();
    const data = overviewBody?.data ?? overviewBody;
    expect(data).toBeTruthy();

    await adminPage.goto(`/admin/analytics?from=${from}&to=${to}`);
    await expect(adminPage.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const csvRes = await request.get(
      `${API_URL}/api/admin/analytics/export.csv?from=${from}&to=${to}`,
      {
        headers: {
          Cookie: session.cookieHeader,
          'X-CSRF-Token': session.csrfToken,
        },
      }
    );
    expect(csvRes.status()).toBe(200);
    expect(csvRes.headers()['content-type'] || '').toMatch(/csv/i);
    const csvText = await csvRes.text();
    const parsed = parseCsv(csvText);
    expect(parsed.headers).toContain('car_name');
    expect(parsed.headers).toContain('car_id');
    expect(
      parsed.rows.some((r) => r.car_name === CAR_NAME || String(r.car_id) === String(carId))
    ).toBeTruthy();

    const cleaner = await insertTestStaff({ roleSlug: 'cleaner' });
    try {
      const cleanerSession = await loginAsStaff(request, cleaner);
      const forbidden = await request.get(
        `${API_URL}/api/admin/analytics/export.csv?from=${from}&to=${to}`,
        {
          headers: {
            Cookie: cleanerSession.cookieHeader,
            'X-CSRF-Token': cleanerSession.csrfToken,
          },
        }
      );
      expect(forbidden.status()).toBe(403);
    } finally {
      await cleanupTestStaff(cleaner.email).catch(() => undefined);
    }
  });
});
