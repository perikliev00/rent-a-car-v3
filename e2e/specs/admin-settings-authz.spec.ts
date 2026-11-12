// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/booking'.
import { openOrderAndResolveConflict, readOrderSummaryTotal } from '../helpers/booking';
// Import named exports from '../helpers/contacts'.
import { createContactViaApi, deleteContactViaApi, updateContactStatusViaApi } from '../helpers/contacts';
// Import named exports from '../helpers/csrf'.
import { apiGet, apiPost, loginAsAdmin } from '../helpers/csrf';
// Import named exports from '../helpers/db'.
import { cleanupE2eCarsByName, cleanupReservationsForCar, cleanupTestCar, insertTestAdmin } from '../helpers/db';
// Import named exports from '../helpers/pricing-config'.
import { restorePricingConfig, snapshotPricingConfig, type PricingConfigSnapshot } from '../helpers/pricing-config';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  STAFF_PASSWORD,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  createStaffUserViaApi,
  // Contribute this line to the enclosing declaration or statement.
  getRoleBySlug,
  // Contribute this line to the enclosing declaration or statement.
  loginAsStaff,
  // Contribute this line to the enclosing declaration or statement.
  putUserRolesViaApi,
  // Contribute this line to the enclosing declaration or statement.
  uniqueStaffEmail,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/rbac';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { API_URL, ADMIN_BASE_URL, adminUrl, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("admin-authz", () => {
  // Call test.describe to perform this step.
  test.describe('Admin authorization', () => {
    // Define a single test case and its expectations.
    test('unauthenticated visitor is redirected away from admin', async ({ page }) => {
      // Wait until the asynchronous operation resolves.
      await page.goto(adminUrl('/admin'));
      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(/\/login/);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: /log in|login|create account/i })).toBeVisible();
    });

    // Define a single test case and its expectations.
    test('customer frontend does not expose the admin application', async ({ page }) => {
      // Wait until the asynchronous operation resolves.
      await page.goto('/admin');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(/page not found/i)).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toHaveCount(0);
    });

    // Define a single test case and its expectations.
    test('customer cannot open admin dashboard', async ({ page }) => {
      // Create the email constant.
      const email = `customer-e2e-${Date.now()}@example.com`;
      // Create the password constant.
      const password = 'Customer123!';

      // Wait until the asynchronous operation resolves.
      await page.goto('/signup');
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Email').fill(email);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Password', { exact: true }).fill(password);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Confirm password').fill(password);
      // Wait until the asynchronous operation resolves.
      await page.getByRole('main').getByRole('button', { name: /sign up|create account/i }).click();

      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await page.goto(adminUrl('/admin'));
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Dashboard' })).not.toBeVisible();
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-pricing-settings", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Pricing Settings ${Date.now()}`;
  // Create the fee delta constant.
  const FEE_DELTA = 77;

  // Call test.describe to perform this step.
  test.describe('ADMIN-018 Pricing settings CRUD/preview/public propagation', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Continue the surrounding logic with this statement.
    let pricingSnapshot: PricingConfigSnapshot | null = null;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 140, nights: 3 });

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (pricingSnapshot) {
        // Wait until the asynchronous operation resolves.
        await restorePricingConfig(pricingSnapshot);
        // Update pricingSnapshot with the right-hand side value.
        pricingSnapshot = null;
      }
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
    test('mutate hotel delivery fee; preview + pricing-info + guest quote; restore', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      request,
      // Contribute this line to the enclosing declaration or statement.
      page,
    // Continue the surrounding logic with this statement.
    }) => {
      // Store the awaited result in pricingSnapshot.
      pricingSnapshot = await snapshotPricingConfig();
      // Create the hotel before constant.
      const hotelBefore = Number(
        // Call pricingSnapshot.globalFees.find to perform this step.
        pricingSnapshot.globalFees.find((f) => f.fee_key === 'hotel_delivery')?.amount ?? 0
      );
      // Create the hotel after constant.
      const hotelAfter = hotelBefore + FEE_DELTA;

      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await adminPage.goto('/admin/pricing');
        // Wait until the asynchronous operation resolves.
        await expect(adminPage.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible({
          // Provide the timeout field value.
          timeout: 15_000,
        });

        // Create the hotel row constant.
        const hotelRow = adminPage
          // Call .locator to perform this step.
          .locator('div.flex.flex-wrap.items-end')
          // Call .filter to perform this step.
          .filter({ hasText: 'hotel_delivery' });
        // Wait until the asynchronous operation resolves.
        await expect(hotelRow.getByText('hotel_delivery', { exact: true })).toBeVisible({
          // Provide the timeout field value.
          timeout: 15_000,
        });
        // Wait until the asynchronous operation resolves.
        await hotelRow.locator('input[type="number"]').fill(String(hotelAfter));
        // Wait until the asynchronous operation resolves.
        await hotelRow.getByRole('button', { name: 'Save', exact: true }).click();
        // Wait until the asynchronous operation resolves.
        await expect(adminPage.getByText('Fee saved')).toBeVisible({ timeout: 15_000 });

        // Create the session constant.
        const session = await loginAsAdmin(request);
        // Create the preview res constant.
        const previewRes = await apiPost(
          // Contribute this line to the enclosing declaration or statement.
          request,
          // Supply the literal value used by the enclosing expression.
          '/api/admin/pricing/preview',
          {
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
            // Provide the hotel delivery field value.
            hotelDelivery: true,
            // Provide the extras field value.
            extras: [],
          },
          // Reference the identifier used by the enclosing expression.
          session
        );
        // Assert that the value matches the intended expectation.
        expect(previewRes.ok(), await previewRes.text()).toBeTruthy();
        // Create the preview body constant.
        const previewBody = await previewRes.json();
        // Create the preview pricing constant.
        const previewPricing = previewBody.data?.pricing ?? previewBody.pricing;
        // Assert that the value matches the intended expectation.
        expect(Number(previewPricing.totalPrice)).toBeGreaterThan(0);
        // Create the hotel line constant.
        const hotelLine = (previewPricing.lines || []).find((l: { label?: string }) =>
          // Continue the surrounding logic with this statement.
          /hotel/i.test(String(l.label || ''))
        );
        // Assert that the value matches the intended expectation.
        expect(hotelLine).toBeTruthy();
        // Assert that the value matches the intended expectation.
        expect(Number(hotelLine.amount)).toBeCloseTo(hotelAfter, 2);

        // Create the info res constant.
        const infoRes = await request.get(`${API_URL}/api/pricing-info`);
        // Assert that the value matches the intended expectation.
        expect(infoRes.ok(), await infoRes.text()).toBeTruthy();
        // Create the info body constant.
        const infoBody = await infoRes.json();
        // Create the info constant.
        const info = infoBody.data ?? infoBody;
        // Create the fees constant.
        const fees = info.globalFees || [];
        // Create the hotel fee constant.
        const hotelFee = fees.find(
          // Continue the surrounding logic with this statement.
          (f: { feeKey?: string; fee_key?: string }) =>
            // Update f.feeKey with the right-hand side value.
            f.feeKey === 'hotel_delivery' || f.fee_key === 'hotel_delivery'
        );
        // Assert that the value matches the intended expectation.
        expect(hotelFee).toBeTruthy();
        // Assert that the value matches the intended expectation.
        expect(Number(hotelFee.amount)).toBeCloseTo(hotelAfter, 2);

        // Wait until the asynchronous operation resolves.
        await cleanupReservationsForCar(carId);
        // Wait until the asynchronous operation resolves.
        await openOrderAndResolveConflict(page, carId, range, { hotelDelivery: true });
        // Create the guest total constant.
        const guestTotal = await readOrderSummaryTotal(page);
        // Assert that the value matches the intended expectation.
        expect(guestTotal).toBeCloseTo(Number(previewPricing.totalPrice), 2);
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Evaluate the condition and enter the branch when it is true.
        if (pricingSnapshot) {
          // Wait until the asynchronous operation resolves.
          await restorePricingConfig(pricingSnapshot);
          // Update pricingSnapshot with the right-hand side value.
          pricingSnapshot = null;
        }
      }
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-audit-logs", () => {
  // Call test.describe to perform this step.
  test.describe('ADMIN-025 Audit logs', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

    // Define a single test case and its expectations.
    test('owner sees audited contact mutation; staff without permission blocked', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the subject constant.
      const subject = `E2E Audit Contact ${Date.now()}`;
      // Create the email constant.
      const email = uniqueEmail('audit-contact');
      // Create the created constant.
      const created = await createContactViaApi(request, {
        // Provide the name field value.
        name: 'Audit Guest',
        // Contribute this line to the enclosing declaration or statement.
        email,
        // Contribute this line to the enclosing declaration or statement.
        subject,
        // Provide the message field value.
        message: 'Audit trail fixture message.',
      });
      // Assert that the value matches the intended expectation.
      expect(created.status, JSON.stringify(created.body)).toBe(200);
      // Create the contact id constant.
      const contactId = created.contactId!;
      // Assert that the value matches the intended expectation.
      expect(contactId).toBeTruthy();

      // Create the owner constant.
      const owner = await loginAsAdmin(request);
      // Create the patched constant.
      const patched = await updateContactStatusViaApi(request, owner, contactId, 'ready');
      // Assert that the value matches the intended expectation.
      expect(patched.status, JSON.stringify(patched.body)).toBe(200);

      // Create the list constant.
      const list = await apiGet(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Continue the surrounding logic with this statement.
        '/api/admin/audit-logs?actionPrefix=admin&action=admin.updated_contact_status&limit=50',
        // Reference the identifier used by the enclosing expression.
        owner
      );
      // Assert that the value matches the intended expectation.
      expect(list.ok(), await list.text()).toBeTruthy();
      // Create the body constant.
      const body = await list.json();
      // Create the logs constant.
      const logs = body?.data?.logs ?? body?.logs ?? [];
      // Create the match constant.
      const match = logs.find(
        // Continue the surrounding logic with this statement.
        (l: { action?: string; entityId?: string | number }) =>
          // Update l.action with the right-hand side value.
          l.action === 'admin.updated_contact_status' &&
          // Call String to perform this step.
          String(l.entityId) === String(contactId)
      );
      // Assert that the value matches the intended expectation.
      expect(match).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(match.actorType || match.adminUser).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/audit-logs');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Audit logs', exact: true })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(/Updated contact status/i).first()).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await deleteContactViaApi(request, owner, contactId);
    });
  });

  // Call test.describe to perform this step.
  test.describe('ADMIN-025 audit logs denied for cleaner', () => {
    // Call test.use to perform this step.
    test.use({ role: 'cleaner' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

    // Define a single test case and its expectations.
    test('cleaner cannot list or open audit logs', async ({ staffPage, staffUser, request }) => {
      // Create the session constant.
      const session = await loginAsStaff(request, staffUser);
      // Create the res constant.
      const res = await apiGet(request, '/api/admin/audit-logs?limit=10', session);
      // Assert that the value matches the intended expectation.
      expect(res.status()).toBe(403);

      // Wait until the asynchronous operation resolves.
      await staffPage.goto('/admin');
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Audit logs' })).toHaveCount(0);
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-user-role-management", () => {
  // Call test.describe to perform this step.
  test.describe('AUTH-004 Owner creates staff; role change on new session', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Create the email constant.
    const email = uniqueStaffEmail('created');

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestStaff(email).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('owner creates support staff; role change reflected on new login', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      request,
      // Contribute this line to the enclosing declaration or statement.
      browser,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await insertTestAdmin();
      // Create the support constant.
      const support = await getRoleBySlug('support');
      // Create the cleaner constant.
      const cleaner = await getRoleBySlug('cleaner');
      // Assert that the value matches the intended expectation.
      expect(support).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(cleaner).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/users');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Users' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: 'Create staff user' })).toBeVisible();

      // Create the created constant.
      const created = await createStaffUserViaApi(request, {
        // Contribute this line to the enclosing declaration or statement.
        email,
        // Provide the password field value.
        password: STAFF_PASSWORD,
        // Provide the role ids field value.
        roleIds: [support!.id],
      });
      // Assert that the value matches the intended expectation.
      expect(created.ok, JSON.stringify(created.body)).toBeTruthy();
      // Create the user id constant.
      const userId = Number(created.body?.data?.user?.id || created.body?.data?.id);
      // Assert that the value matches the intended expectation.
      expect(userId).toBeTruthy();

      // Create the session constant.
      const session = await loginAsStaff(request, { email, password: STAFF_PASSWORD });
      // Create the context constant.
      const context = await browser.newContext({ baseURL: ADMIN_BASE_URL });
      // Create the page constant.
      const page = await context.newPage();
      // Wait until the asynchronous operation resolves.
      await page.goto('/login');
      // Wait until the asynchronous operation resolves.
      await page.getByLabel(/^email$/i).fill(email);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel(/^password$/i).fill(STAFF_PASSWORD);
      // Wait until the asynchronous operation resolves.
      await page.locator('form').getByRole('button', { name: 'Log in' }).click();
      // Wait until the asynchronous operation resolves.
      await page.waitForURL(/\/admin/, { timeout: 20_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('link', { name: 'Contacts' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('link', { name: 'Cars' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('link', { name: 'Payments' })).toHaveCount(0);

      // Create the admin session constant.
      const adminSession = await loginAsAdmin(request);
      // Create the changed constant.
      const changed = await putUserRolesViaApi(request, userId, [cleaner!.id], adminSession);
      // Assert that the value matches the intended expectation.
      expect(changed.ok, JSON.stringify(changed.body)).toBeTruthy();

      // Create the stale constant.
      const stale = await apiGet(request, '/api/admin/orders', session);
      // Assert that the value matches the intended expectation.
      expect([401, 403]).toContain(stale.status());

      // Wait until the asynchronous operation resolves.
      await page.goto('/login');
      // Wait until the asynchronous operation resolves.
      await page.getByLabel(/^email$/i).fill(email);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel(/^password$/i).fill(STAFF_PASSWORD);
      // Wait until the asynchronous operation resolves.
      await page.locator('form').getByRole('button', { name: 'Log in' }).click();
      // Wait until the asynchronous operation resolves.
      await page.waitForURL(/\/admin/, { timeout: 20_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('link', { name: 'Cars' })).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('link', { name: 'Fleet alerts' }).first()).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('link', { name: 'Orders' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await context.close();
    });
  });
});
