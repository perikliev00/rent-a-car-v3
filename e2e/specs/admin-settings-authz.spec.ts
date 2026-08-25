import { expect, test } from '../fixtures/base';
import { signupVerifiedViaUi } from '../helpers/account';
import { openOrderAndResolveConflict, readOrderSummaryTotal } from '../helpers/booking';
import { createContactViaApi, deleteContactViaApi, updateContactStatusViaApi } from '../helpers/contacts';
import { apiGet, apiPost, loginAsAdmin } from '../helpers/csrf';
import { cleanupE2eCarsByName, cleanupReservationsForCar, cleanupTestCar, insertTestAdmin } from '../helpers/db';
import { restorePricingConfig, snapshotPricingConfig, type PricingConfigSnapshot } from '../helpers/pricing-config';
import {
  STAFF_PASSWORD,
  cleanupTestStaff,
  createStaffUserViaApi,
  getRoleBySlug,
  loginAsStaff,
  putUserRolesViaApi,
  uniqueStaffEmail,
} from '../helpers/rbac';
import { seedE2eFixtures } from '../helpers/seed';
import { API_URL, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("admin-authz", () => {
  test.describe('Admin authorization', () => {
    test('unauthenticated visitor is redirected away from admin', async ({ page }) => {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: /log in|login|create account/i })).toBeVisible();
    });

    test('customer cannot open admin dashboard', async ({ page }) => {
      const email = `customer-e2e-${Date.now()}@example.com`;

      await signupVerifiedViaUi(page, { email, password: 'Customer123!' });

      await page.goto('/admin');
      await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole('heading', { name: 'Dashboard' })).not.toBeVisible();
    });
  });
});

test.describe("admin-pricing-settings", () => {
  const CAR_NAME = `E2E Pricing Settings ${Date.now()}`;
  const FEE_DELTA = 77;

  test.describe('ADMIN-018 Pricing settings CRUD/preview/public propagation', () => {
    test.setTimeout(120_000);

    let carId: number;
    let pricingSnapshot: PricingConfigSnapshot | null = null;
    const range = allocateFutureRange({ fromDaysAhead: 140, nights: 3 });

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      if (pricingSnapshot) {
        await restorePricingConfig(pricingSnapshot);
        pricingSnapshot = null;
      }
      await cleanupReservationsForCar(carId);
      await cleanupTestCar(carId);
    });

    test.beforeEach(async () => {
      await cleanupReservationsForCar(carId);
    });

    test('mutate hotel delivery fee; preview + pricing-info + guest quote; restore', async ({
      adminPage,
      request,
      page,
    }) => {
      pricingSnapshot = await snapshotPricingConfig();
      const hotelBefore = Number(
        pricingSnapshot.globalFees.find((f) => f.fee_key === 'hotel_delivery')?.amount ?? 0
      );
      const hotelAfter = hotelBefore + FEE_DELTA;

      try {
        await adminPage.goto('/admin/pricing');
        await expect(adminPage.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible({
          timeout: 15_000,
        });

        const hotelRow = adminPage
          .locator('div.flex.flex-wrap.items-end')
          .filter({ hasText: 'hotel_delivery' });
        await expect(hotelRow.getByText('hotel_delivery', { exact: true })).toBeVisible({
          timeout: 15_000,
        });
        await hotelRow.locator('input[type="number"]').fill(String(hotelAfter));
        await hotelRow.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(adminPage.getByText('Fee saved')).toBeVisible({ timeout: 15_000 });

        const session = await loginAsAdmin(request);
        const previewRes = await apiPost(
          request,
          '/api/admin/pricing/preview',
          {
            carId,
            pickupDate: range.pickupDate,
            returnDate: range.returnDate,
            pickupTime: range.pickupTime,
            returnTime: range.returnTime,
            pickupLocation: 'office',
            returnLocation: 'office',
            hotelDelivery: true,
            extras: [],
          },
          session
        );
        expect(previewRes.ok(), await previewRes.text()).toBeTruthy();
        const previewBody = await previewRes.json();
        const previewPricing = previewBody.data?.pricing ?? previewBody.pricing;
        expect(Number(previewPricing.totalPrice)).toBeGreaterThan(0);
        const hotelLine = (previewPricing.lines || []).find((l: { label?: string }) =>
          /hotel/i.test(String(l.label || ''))
        );
        expect(hotelLine).toBeTruthy();
        expect(Number(hotelLine.amount)).toBeCloseTo(hotelAfter, 2);

        const infoRes = await request.get(`${API_URL}/api/pricing-info`);
        expect(infoRes.ok(), await infoRes.text()).toBeTruthy();
        const infoBody = await infoRes.json();
        const info = infoBody.data ?? infoBody;
        const fees = info.globalFees || [];
        const hotelFee = fees.find(
          (f: { feeKey?: string; fee_key?: string }) =>
            f.feeKey === 'hotel_delivery' || f.fee_key === 'hotel_delivery'
        );
        expect(hotelFee).toBeTruthy();
        expect(Number(hotelFee.amount)).toBeCloseTo(hotelAfter, 2);

        await cleanupReservationsForCar(carId);
        await openOrderAndResolveConflict(page, carId, range, { hotelDelivery: true });
        const guestTotal = await readOrderSummaryTotal(page);
        expect(guestTotal).toBeCloseTo(Number(previewPricing.totalPrice), 2);
      } finally {
        if (pricingSnapshot) {
          await restorePricingConfig(pricingSnapshot);
          pricingSnapshot = null;
        }
      }
    });
  });
});

test.describe("admin-audit-logs", () => {
  test.describe('ADMIN-025 Audit logs', () => {
    test.setTimeout(90_000);

    test('owner sees audited contact mutation; staff without permission blocked', async ({
      adminPage,
      request,
    }) => {
      const subject = `E2E Audit Contact ${Date.now()}`;
      const email = uniqueEmail('audit-contact');
      const created = await createContactViaApi(request, {
        name: 'Audit Guest',
        email,
        subject,
        message: 'Audit trail fixture message.',
      });
      expect(created.status, JSON.stringify(created.body)).toBe(200);
      const contactId = created.contactId!;
      expect(contactId).toBeTruthy();

      const owner = await loginAsAdmin(request);
      const patched = await updateContactStatusViaApi(request, owner, contactId, 'ready');
      expect(patched.status, JSON.stringify(patched.body)).toBe(200);

      const list = await apiGet(
        request,
        '/api/admin/audit-logs?actionPrefix=admin&action=admin.updated_contact_status&limit=50',
        owner
      );
      expect(list.ok(), await list.text()).toBeTruthy();
      const body = await list.json();
      const logs = body?.data?.logs ?? body?.logs ?? [];
      const match = logs.find(
        (l: { action?: string; entityId?: string | number }) =>
          l.action === 'admin.updated_contact_status' &&
          String(l.entityId) === String(contactId)
      );
      expect(match).toBeTruthy();
      expect(match.actorType || match.adminUser).toBeTruthy();

      await adminPage.goto('/admin/audit-logs');
      await expect(adminPage.getByRole('heading', { name: 'Audit logs', exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(adminPage.getByText(/Updated contact status/i).first()).toBeVisible({
        timeout: 15_000,
      });

      await deleteContactViaApi(request, owner, contactId);
    });
  });

  test.describe('ADMIN-025 audit logs denied for cleaner', () => {
    test.use({ role: 'cleaner' });
    test.setTimeout(90_000);

    test('cleaner cannot list or open audit logs', async ({ staffPage, staffUser, request }) => {
      const session = await loginAsStaff(request, staffUser);
      const res = await apiGet(request, '/api/admin/audit-logs?limit=10', session);
      expect(res.status()).toBe(403);

      await staffPage.goto('/admin');
      await expect(staffPage.getByRole('link', { name: 'Audit logs' })).toHaveCount(0);
    });
  });
});

test.describe("admin-user-role-management", () => {
  test.describe('AUTH-004 Owner creates staff; role change on new session', () => {
    test.setTimeout(120_000);

    const email = uniqueStaffEmail('created');

    test.afterAll(async () => {
      await cleanupTestStaff(email).catch(() => undefined);
    });

    test('owner creates support staff; role change reflected on new login', async ({
      adminPage,
      request,
      browser,
    }) => {
      await insertTestAdmin();
      const support = await getRoleBySlug('support');
      const cleaner = await getRoleBySlug('cleaner');
      expect(support).toBeTruthy();
      expect(cleaner).toBeTruthy();

      await adminPage.goto('/admin/users');
      await expect(adminPage.getByRole('heading', { name: 'Users' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(adminPage.getByRole('heading', { name: 'Create staff user' })).toBeVisible();

      const created = await createStaffUserViaApi(request, {
        email,
        password: STAFF_PASSWORD,
        roleIds: [support!.id],
      });
      expect(created.ok, JSON.stringify(created.body)).toBeTruthy();
      const userId = Number(created.body?.data?.user?.id || created.body?.data?.id);
      expect(userId).toBeTruthy();

      const session = await loginAsStaff(request, { email, password: STAFF_PASSWORD });
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('/login');
      await page.getByLabel(/^email$/i).fill(email);
      await page.getByLabel(/^password$/i).fill(STAFF_PASSWORD);
      await page.locator('form').getByRole('button', { name: 'Log in' }).click();
      await page.waitForURL(/\/admin/, { timeout: 20_000 });
      await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('link', { name: 'Contacts' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Cars' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Payments' })).toHaveCount(0);

      const adminSession = await loginAsAdmin(request);
      const changed = await putUserRolesViaApi(request, userId, [cleaner!.id], adminSession);
      expect(changed.ok, JSON.stringify(changed.body)).toBeTruthy();

      const stale = await apiGet(request, '/api/admin/orders', session);
      expect([401, 403]).toContain(stale.status());

      await page.goto('/login');
      await page.getByLabel(/^email$/i).fill(email);
      await page.getByLabel(/^password$/i).fill(STAFF_PASSWORD);
      await page.locator('form').getByRole('button', { name: 'Log in' }).click();
      await page.waitForURL(/\/admin/, { timeout: 20_000 });
      await expect(page.getByRole('link', { name: 'Cars' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('link', { name: 'Fleet alerts' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Orders' })).toHaveCount(0);
      await context.close();
    });
  });
});
