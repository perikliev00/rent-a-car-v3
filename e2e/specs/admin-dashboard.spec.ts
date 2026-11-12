// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/csrf'.
import { apiGet, loginAsAdmin } from '../helpers/csrf';
// Import named exports from '../helpers/csv'.
import { parseCsv } from '../helpers/csv';
// Import named exports from '../helpers/dates'.
import { addSofiaCalendarDays, formatSofiaIsoDateFromParts, getSofiaIsoDateString } from '../helpers/dates';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/rbac'.
import { cleanupTestStaff, insertTestStaff, loginAsStaff } from '../helpers/rbac';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { API_URL, E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("admin-dashboard-permissions", () => {
  // Call test.describe to perform this step.
  test.describe('ADMIN-022 Dashboard counters + permission masking', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

    // Define a single test case and its expectations.
    test('owner sees numeric counters', async ({ adminPage, request }) => {
      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText('Total orders')).toBeVisible();

      // Create the session constant.
      const session = await loginAsAdmin(request);
      // Create the res constant.
      const res = await apiGet(request, '/api/admin/dashboard', session);
      // Assert that the value matches the intended expectation.
      expect(res.ok()).toBeTruthy();
      // Create the body constant.
      const body = await res.json();
      // Create the stats constant.
      const stats = body?.data?.stats ?? body?.stats;
      // Assert that the value matches the intended expectation.
      expect(stats.totalOrders).not.toBeNull();
      // Assert that the value matches the intended expectation.
      expect(typeof stats.totalOrders).toBe('number');
      // Assert that the value matches the intended expectation.
      expect(stats.totalRevenue).not.toBeNull();
    });
  });

  // Call test.describe to perform this step.
  test.describe('ADMIN-022 cleaner masked stats', () => {
    // Call test.use to perform this step.
    test.use({ role: 'cleaner' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

    // Define a single test case and its expectations.
    test('cleaner dashboard masks orders/revenue as em dash', async ({
      // Contribute this line to the enclosing declaration or statement.
      staffPage,
      // Contribute this line to the enclosing declaration or statement.
      staffUser,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the session constant.
      const session = await loginAsStaff(request, staffUser);
      // Create the res constant.
      const res = await apiGet(request, '/api/admin/dashboard', session);
      // Assert that the value matches the intended expectation.
      expect(res.ok()).toBeTruthy();
      // Create the body constant.
      const body = await res.json();
      // Create the stats constant.
      const stats = body?.data?.stats ?? body?.stats;
      // Assert that the value matches the intended expectation.
      expect(stats.totalOrders).toBeNull();
      // Assert that the value matches the intended expectation.
      expect(stats.pendingOrders).toBeNull();
      // Assert that the value matches the intended expectation.
      expect(stats.totalRevenue).toBeNull();

      // Wait until the asynchronous operation resolves.
      await staffPage.goto('/admin');
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Create the orders card constant.
      const ordersCard = staffPage
        // Call .locator to perform this step.
        .locator('div.rounded-2xl')
        // Call .filter to perform this step.
        .filter({ hasText: 'Total orders' })
        // Call .first to perform this step.
        .first();
      // Wait until the asynchronous operation resolves.
      await expect(ordersCard.getByText('—', { exact: true })).toBeVisible();

      // Create the revenue card constant.
      const revenueCard = staffPage
        // Call .locator to perform this step.
        .locator('div.rounded-2xl')
        // Call .filter to perform this step.
        .filter({ hasText: 'Total revenue' })
        // Call .first to perform this step.
        .first();
      // Wait until the asynchronous operation resolves.
      await expect(revenueCard.getByText('—', { exact: true })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(revenueCard.getByText(/€0/)).toHaveCount(0);
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-ops-dashboard", () => {
  // Create the prefix constant.
  const PREFIX = `E2E Ops Dash ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-010 Ops dashboard real buckets', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Continue the surrounding logic with this statement.
    const carIds: number[] = [];
    // Create the today constant.
    const today = getSofiaIsoDateString();
    // Create the yesterday constant.
    const yesterday = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), -1));
    // Create the tomorrow constant.
    const tomorrow = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), 1));
    // Create the future constant.
    const future = allocateFutureRange({ fromDaysAhead: 45, nights: 2 });

    // Create the emails constant.
    const emails = {
      // Provide the pickup field value.
      pickup: uniqueEmail('ops-pickup'),
      // Provide the returns field value.
      returns: uniqueEmail('ops-returns'),
      // Provide the active field value.
      active: uniqueEmail('ops-active'),
      // Provide the review field value.
      review: uniqueEmail('ops-review'),
      // Provide the paid field value.
      paid: uniqueEmail('ops-paid'),
      // Provide the cancelled field value.
      cancelled: uniqueEmail('ops-cancelled'),
      // Provide the expired field value.
      expired: uniqueEmail('ops-expired'),
    };

    // Continue the surrounding logic with this statement.
    let ids: Record<string, number> = {};

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await seedE2eFixtures(`${PREFIX} seed`);
      // Iterate using the loop initializer, condition, and step.
      for (let i = 0; i < 7; i += 1) {
        // Call carIds.push to perform this step.
        carIds.push(await insertIsolatedTestCar(`${PREFIX} Car ${i}`, 55 + i));
      }

      // Destructure array values into local variables.
      const [
        // Contribute this line to the enclosing declaration or statement.
        pickup,
        // Contribute this line to the enclosing declaration or statement.
        returns,
        // Contribute this line to the enclosing declaration or statement.
        active,
        // Contribute this line to the enclosing declaration or statement.
        review,
        // Contribute this line to the enclosing declaration or statement.
        paid,
        // Contribute this line to the enclosing declaration or statement.
        cancelled,
        // Contribute this line to the enclosing declaration or statement.
        expired,
      // Store the awaited result in ].
      ] = await Promise.all([
        // Call seedLinkedBooking to perform this step.
        seedLinkedBooking({
          // Provide the car id field value.
          carId: carIds[0],
          // Provide the status field value.
          status: 'confirmed',
          // Provide the pickup date field value.
          pickupDate: today,
          // Provide the return date field value.
          returnDate: tomorrow,
          // Provide the guest field value.
          guest: { ...E2E_GUEST, email: emails.pickup, fullName: 'Ops Pickup' },
        }),
        // Call seedLinkedBooking to perform this step.
        seedLinkedBooking({
          // Provide the car id field value.
          carId: carIds[1],
          // Provide the status field value.
          status: 'active_rental',
          // Provide the pickup date field value.
          pickupDate: yesterday,
          // Provide the return date field value.
          returnDate: today,
          // Provide the guest field value.
          guest: { ...E2E_GUEST, email: emails.returns, fullName: 'Ops Returns' },
        }),
        // Call seedLinkedBooking to perform this step.
        seedLinkedBooking({
          // Provide the car id field value.
          carId: carIds[2],
          // Provide the status field value.
          status: 'picked_up',
          // Provide the pickup date field value.
          pickupDate: yesterday,
          // Provide the return date field value.
          returnDate: tomorrow,
          // Provide the guest field value.
          guest: { ...E2E_GUEST, email: emails.active, fullName: 'Ops Active' },
        }),
        // Call seedLinkedBooking to perform this step.
        seedLinkedBooking({
          // Provide the car id field value.
          carId: carIds[3],
          // Provide the status field value.
          status: 'manual_review',
          // Provide the pickup date field value.
          pickupDate: future.pickupDate,
          // Provide the return date field value.
          returnDate: future.returnDate,
          // Provide the guest field value.
          guest: { ...E2E_GUEST, email: emails.review, fullName: 'Ops Review' },
        }),
        // Call seedLinkedBooking to perform this step.
        seedLinkedBooking({
          // Provide the car id field value.
          carId: carIds[4],
          // Provide the status field value.
          status: 'paid',
          // Provide the pickup date field value.
          pickupDate: future.pickupDate,
          // Provide the return date field value.
          returnDate: future.returnDate,
          // Provide the guest field value.
          guest: { ...E2E_GUEST, email: emails.paid, fullName: 'Ops Paid' },
        }),
        // Call seedLinkedBooking to perform this step.
        seedLinkedBooking({
          // Provide the car id field value.
          carId: carIds[5],
          // Provide the status field value.
          status: 'cancelled',
          // Provide the pickup date field value.
          pickupDate: future.pickupDate,
          // Provide the return date field value.
          returnDate: future.returnDate,
          // Provide the with block field value.
          withBlock: false,
          // Provide the guest field value.
          guest: { ...E2E_GUEST, email: emails.cancelled, fullName: 'Ops Cancelled' },
        }),
        // Call seedLinkedBooking to perform this step.
        seedLinkedBooking({
          // Provide the car id field value.
          carId: carIds[6],
          // Provide the status field value.
          status: 'expired',
          // Provide the pickup date field value.
          pickupDate: future.pickupDate,
          // Provide the return date field value.
          returnDate: future.returnDate,
          // Provide the with block field value.
          withBlock: false,
          // Provide the guest field value.
          guest: { ...E2E_GUEST, email: emails.expired, fullName: 'Ops Expired' },
        }),
      ]);

      // Update ids with the right-hand side value.
      ids = {
        // Provide the pickup field value.
        pickup: pickup.reservationId,
        // Provide the returns field value.
        returns: returns.reservationId,
        // Provide the active field value.
        active: active.reservationId,
        // Provide the review field value.
        review: review.reservationId,
        // Provide the paid field value.
        paid: paid.reservationId,
        // Provide the cancelled field value.
        cancelled: cancelled.reservationId,
        // Provide the expired field value.
        expired: expired.reservationId,
      };
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Iterate using the loop initializer, condition, and step.
      for (const id of carIds) {
        // Wait until the asynchronous operation resolves.
        await cleanupReservationsForCar(id);
        // Wait until the asynchronous operation resolves.
        await cleanupTestCar(id);
      }
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(`${PREFIX} seed`);
    });

    // Define a single test case and its expectations.
    test('widgets list seeded reservations in the correct buckets', async ({ adminPage }) => {
      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/reservations');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Continue the surrounding logic with this statement.
      const widgetAssertions: Array<{ title: string; email: string; id: number }> = [
        // Contribute this line to the enclosing declaration or statement.
        { title: "Today's Pickups", email: emails.pickup, id: ids.pickup },
        // Contribute this line to the enclosing declaration or statement.
        { title: "Today's Returns", email: emails.returns, id: ids.returns },
        // Contribute this line to the enclosing declaration or statement.
        { title: 'Active Rentals', email: emails.active, id: ids.active },
        // Contribute this line to the enclosing declaration or statement.
        { title: 'Manual Review', email: emails.review, id: ids.review },
        // Contribute this line to the enclosing declaration or statement.
        { title: 'Paid — Not Confirmed', email: emails.paid, id: ids.paid },
        // Contribute this line to the enclosing declaration or statement.
        { title: 'Cancelled', email: emails.cancelled, id: ids.cancelled },
        // Contribute this line to the enclosing declaration or statement.
        { title: 'Failed / Expired Payments', email: emails.expired, id: ids.expired },
      ];

      // Iterate using the loop initializer, condition, and step.
      for (const { title, email, id } of widgetAssertions) {
        // Wait until the asynchronous operation resolves.
        await expect(adminPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
        // Same reservation can appear in multiple widgets (e.g. Today's Returns + Active Rentals).
        await expect(adminPage.getByText(email).first()).toBeVisible({ timeout: 15_000 });
        // Wait until the asynchronous operation resolves.
        await expect(adminPage.getByRole('button', { name: String(id), exact: true }).first()).toBeVisible();
      }

      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: String(ids.pickup), exact: true }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage).toHaveURL(new RegExp(`id=${ids.pickup}`));
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Status History' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-analytics", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Analytics ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-023 Analytics + CSV real aggregates', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 2, nights: 3 });
    // Create the now constant.
    const now = new Date();
    // Create the from date constant.
    const fromDate = new Date(now);
    // Call fromDate.setUTCDate to perform this step.
    fromDate.setUTCDate(fromDate.getUTCDate() - 30);
    // Create the to date constant.
    const toDate = new Date(now);
    // Call toDate.setUTCDate to perform this step.
    toDate.setUTCDate(toDate.getUTCDate() + 30);
    // Create the from constant.
    const from = fromDate.toISOString().slice(0, 10);
    // Create the to constant.
    const to = toDate.toISOString().slice(0, 10);

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
    test('overview KPIs + CSV export; export forbidden without permission', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await seedLinkedBooking({
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
        guest: { ...E2E_GUEST, email: uniqueEmail('analytics'), fullName: 'Analytics Guest' },
        // Provide the total price field value.
        totalPrice: 220,
      });

      // Create the session constant.
      const session = await loginAsAdmin(request);
      // Create the overview constant.
      const overview = await apiGet(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Continue the surrounding logic with this statement.
        `/api/admin/analytics/overview?from=${from}&to=${to}`,
        // Reference the identifier used by the enclosing expression.
        session
      );
      // Assert that the value matches the intended expectation.
      expect(overview.ok(), await overview.text()).toBeTruthy();
      // Create the overview body constant.
      const overviewBody = await overview.json();
      // Create the data constant.
      const data = overviewBody?.data ?? overviewBody;
      // Assert that the value matches the intended expectation.
      expect(data).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await adminPage.goto(`/admin/analytics?from=${from}&to=${to}`);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Create the csv res constant.
      const csvRes = await request.get(
        // Continue the surrounding logic with this statement.
        `${API_URL}/api/admin/analytics/export.csv?from=${from}&to=${to}`,
        {
          // Provide the headers field value.
          headers: {
            // Provide the cookie field value.
            Cookie: session.cookieHeader,
            // Supply the literal value used by the enclosing expression.
            'X-CSRF-Token': session.csrfToken,
          },
        }
      );
      // Assert that the value matches the intended expectation.
      expect(csvRes.status()).toBe(200);
      // Assert that the value matches the intended expectation.
      expect(csvRes.headers()['content-type'] || '').toMatch(/csv/i);
      // Create the csv text constant.
      const csvText = await csvRes.text();
      // Create the parsed constant.
      const parsed = parseCsv(csvText);
      // Assert that the value matches the intended expectation.
      expect(parsed.headers).toContain('car_name');
      // Assert that the value matches the intended expectation.
      expect(parsed.headers).toContain('car_id');
      // Assert that the value matches the intended expectation.
      expect(
        // Call parsed.rows.some to perform this step.
        parsed.rows.some((r) => r.car_name === CAR_NAME || String(r.car_id) === String(carId))
      // Continue the surrounding logic with this statement.
      ).toBeTruthy();

      // Create the cleaner constant.
      const cleaner = await insertTestStaff({ roleSlug: 'cleaner' });
      // Start a try block for operations that may fail.
      try {
        // Create the cleaner session constant.
        const cleanerSession = await loginAsStaff(request, cleaner);
        // Create the forbidden constant.
        const forbidden = await request.get(
          // Continue the surrounding logic with this statement.
          `${API_URL}/api/admin/analytics/export.csv?from=${from}&to=${to}`,
          {
            // Provide the headers field value.
            headers: {
              // Provide the cookie field value.
              Cookie: cleanerSession.cookieHeader,
              // Supply the literal value used by the enclosing expression.
              'X-CSRF-Token': cleanerSession.csrfToken,
            },
          }
        );
        // Assert that the value matches the intended expectation.
        expect(forbidden.status()).toBe(403);
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Wait until the asynchronous operation resolves.
        await cleanupTestStaff(cleaner.email).catch(() => undefined);
      }
    });
  });
});
