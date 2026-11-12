import { expect, test } from '../fixtures/base';
import { apiGet, loginAsAdmin } from '../helpers/csrf';
import { parseCsv } from '../helpers/csv';
import { addSofiaCalendarDays, formatSofiaIsoDateFromParts, getSofiaIsoDateString } from '../helpers/dates';
import {
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  insertIsolatedTestCar,
} from '../helpers/db';
import { cleanupTestStaff, insertTestStaff, loginAsStaff } from '../helpers/rbac';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { API_URL, E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("admin-dashboard-permissions", () => {
  test.describe('ADMIN-022 Dashboard counters + permission masking', () => {
    test.setTimeout(90_000);

    test('owner sees numeric counters', async ({ adminPage, request }) => {
      await adminPage.goto('/admin');
      await expect(adminPage.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(adminPage.getByText('Total orders')).toBeVisible();

      const session = await loginAsAdmin(request);
      const res = await apiGet(request, '/api/admin/dashboard', session);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const stats = body?.data?.stats ?? body?.stats;
      expect(stats.totalOrders).not.toBeNull();
      expect(typeof stats.totalOrders).toBe('number');
      expect(stats.totalRevenue).not.toBeNull();
    });
  });

  test.describe('ADMIN-022 cleaner masked stats', () => {
    test.use({ role: 'cleaner' });
    test.setTimeout(90_000);

    test('cleaner dashboard masks orders/revenue as em dash', async ({
      staffPage,
      staffUser,
      request,
    }) => {
      const session = await loginAsStaff(request, staffUser);
      const res = await apiGet(request, '/api/admin/dashboard', session);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const stats = body?.data?.stats ?? body?.stats;
      expect(stats.totalOrders).toBeNull();
      expect(stats.pendingOrders).toBeNull();
      expect(stats.totalRevenue).toBeNull();

      await staffPage.goto('/admin');
      await expect(staffPage.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
        timeout: 15_000,
      });

      const ordersCard = staffPage
        .locator('div.rounded-2xl')
        .filter({ hasText: 'Total orders' })
        .first();
      await expect(ordersCard.getByText('—', { exact: true })).toBeVisible();

      const revenueCard = staffPage
        .locator('div.rounded-2xl')
        .filter({ hasText: 'Total revenue' })
        .first();
      await expect(revenueCard.getByText('—', { exact: true })).toBeVisible();
      await expect(revenueCard.getByText(/€0/)).toHaveCount(0);
    });
  });
});

test.describe("admin-ops-dashboard", () => {
  const PREFIX = `E2E Ops Dash ${Date.now()}`;

  test.describe('ADMIN-010 Ops dashboard real buckets', () => {
    test.setTimeout(180_000);

    const carIds: number[] = [];
    const today = getSofiaIsoDateString();
    const yesterday = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), -1));
    const tomorrow = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), 1));
    const future = allocateFutureRange({ fromDaysAhead: 45, nights: 2 });

    const emails = {
      pickup: uniqueEmail('ops-pickup'),
      returns: uniqueEmail('ops-returns'),
      active: uniqueEmail('ops-active'),
      review: uniqueEmail('ops-review'),
      paid: uniqueEmail('ops-paid'),
      cancelled: uniqueEmail('ops-cancelled'),
      expired: uniqueEmail('ops-expired'),
    };

    let ids: Record<string, number> = {};

    test.beforeAll(async () => {
      await seedE2eFixtures(`${PREFIX} seed`);
      for (let i = 0; i < 7; i += 1) {
        carIds.push(await insertIsolatedTestCar(`${PREFIX} Car ${i}`, 55 + i));
      }

      const [
        pickup,
        returns,
        active,
        review,
        paid,
        cancelled,
        expired,
      ] = await Promise.all([
        seedLinkedBooking({
          carId: carIds[0],
          status: 'confirmed',
          pickupDate: today,
          returnDate: tomorrow,
          guest: { ...E2E_GUEST, email: emails.pickup, fullName: 'Ops Pickup' },
        }),
        seedLinkedBooking({
          carId: carIds[1],
          status: 'active_rental',
          pickupDate: yesterday,
          returnDate: today,
          guest: { ...E2E_GUEST, email: emails.returns, fullName: 'Ops Returns' },
        }),
        seedLinkedBooking({
          carId: carIds[2],
          status: 'picked_up',
          pickupDate: yesterday,
          returnDate: tomorrow,
          guest: { ...E2E_GUEST, email: emails.active, fullName: 'Ops Active' },
        }),
        seedLinkedBooking({
          carId: carIds[3],
          status: 'manual_review',
          pickupDate: future.pickupDate,
          returnDate: future.returnDate,
          guest: { ...E2E_GUEST, email: emails.review, fullName: 'Ops Review' },
        }),
        seedLinkedBooking({
          carId: carIds[4],
          status: 'paid',
          pickupDate: future.pickupDate,
          returnDate: future.returnDate,
          guest: { ...E2E_GUEST, email: emails.paid, fullName: 'Ops Paid' },
        }),
        seedLinkedBooking({
          carId: carIds[5],
          status: 'cancelled',
          pickupDate: future.pickupDate,
          returnDate: future.returnDate,
          withBlock: false,
          guest: { ...E2E_GUEST, email: emails.cancelled, fullName: 'Ops Cancelled' },
        }),
        seedLinkedBooking({
          carId: carIds[6],
          status: 'expired',
          pickupDate: future.pickupDate,
          returnDate: future.returnDate,
          withBlock: false,
          guest: { ...E2E_GUEST, email: emails.expired, fullName: 'Ops Expired' },
        }),
      ]);

      ids = {
        pickup: pickup.reservationId,
        returns: returns.reservationId,
        active: active.reservationId,
        review: review.reservationId,
        paid: paid.reservationId,
        cancelled: cancelled.reservationId,
        expired: expired.reservationId,
      };
    });

    test.afterAll(async () => {
      for (const id of carIds) {
        await cleanupReservationsForCar(id);
        await cleanupTestCar(id);
      }
      await cleanupE2eCarsByName(`${PREFIX} seed`);
    });

    test('widgets list seeded reservations in the correct buckets', async ({ adminPage }) => {
      await adminPage.goto('/admin/reservations');
      await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
        timeout: 15_000,
      });

      const widgetAssertions: Array<{ title: string; email: string; id: number }> = [
        { title: "Today's Pickups", email: emails.pickup, id: ids.pickup },
        { title: "Today's Returns", email: emails.returns, id: ids.returns },
        { title: 'Active Rentals', email: emails.active, id: ids.active },
        { title: 'Manual Review', email: emails.review, id: ids.review },
        { title: 'Paid — Not Confirmed', email: emails.paid, id: ids.paid },
        { title: 'Cancelled', email: emails.cancelled, id: ids.cancelled },
        { title: 'Failed / Expired Payments', email: emails.expired, id: ids.expired },
      ];

      for (const { title, email, id } of widgetAssertions) {
        await expect(adminPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
        // Same reservation can appear in multiple widgets (e.g. Today's Returns + Active Rentals).
        await expect(adminPage.getByText(email).first()).toBeVisible({ timeout: 15_000 });
        await expect(adminPage.getByRole('button', { name: String(id), exact: true }).first()).toBeVisible();
      }

      await adminPage.getByRole('button', { name: String(ids.pickup), exact: true }).click();
      await expect(adminPage).toHaveURL(new RegExp(`id=${ids.pickup}`));
      await expect(adminPage.getByRole('heading', { name: 'Status History' })).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});

test.describe("admin-analytics", () => {
  const CAR_NAME = `E2E Analytics ${Date.now()}`;

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
});
