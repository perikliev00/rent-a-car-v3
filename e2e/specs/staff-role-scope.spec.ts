import { expect, test } from '../fixtures/base';
import { apiGet, apiPost } from '../helpers/csrf';
import { insertTestAdmin } from '../helpers/db';
import {
  cleanupTestStaff,
  createCalendarTaskViaApi,
  insertTestStaff,
  loginAsStaff,
  updateTaskStatusViaApi,
} from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });

test.describe("staff-receptionist", () => {
  test.describe('STAFF-003 Receptionist scope', () => {
    test.use({ role: 'receptionist' });
    test.setTimeout(90_000);

    test('receptionist nav and API scope', async ({ staffPage, staffUser, request }) => {
      await insertTestAdmin();

      await expect(staffPage.getByRole('link', { name: 'Ops' })).toBeVisible({ timeout: 15_000 });
      await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible();
      await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible();
      await expect(staffPage.getByRole('link', { name: 'Contacts' })).toBeVisible();
      await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toBeVisible();
      await expect(staffPage.getByRole('link', { name: 'My tasks' })).toBeVisible();

      await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Roles' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Cars' })).toHaveCount(0);

      await staffPage.goto('/admin/tasks');
      await expect(staffPage.getByRole('heading', { name: 'Task board' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(staffPage.getByRole('button', { name: 'Create task' })).toBeVisible();
      await staffPage.getByRole('button', { name: 'Create task' }).click();
      await expect(staffPage.getByRole('heading', { name: 'Create task' })).toBeVisible();
      await expect(staffPage.getByLabel('Assignee', { exact: true })).toHaveCount(0);

      const session = await loginAsStaff(request, staffUser);
      const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const dueAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      const created = await createCalendarTaskViaApi(
        request,
        { title: `E2E Reception Task ${Date.now()}`, taskType: 'document_check', startsAt, dueAt },
        session
      );
      expect(created.ok, JSON.stringify(created.body)).toBeTruthy();

      const assignable = await apiGet(request, '/api/admin/calendar/assignable-staff', session);
      expect(assignable.status()).toBe(403);

      const refund = await apiPost(request, '/api/admin/payments/reconcile', { dryRun: true }, session);
      expect(refund.status()).toBe(403);

      const users = await apiGet(request, '/api/admin/users', session);
      expect(users.status()).toBe(403);
    });
  });
});

test.describe("staff-accountant", () => {
  test.describe('STAFF-005 Accountant scope', () => {
    test.use({ role: 'accountant' });
    test.setTimeout(90_000);

    test('accountant payments/orders; no ops or tasks', async ({ staffPage, staffUser, request }) => {
      await insertTestAdmin();

      await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
      await expect(staffPage.getByRole('link', { name: 'Payments' })).toBeVisible();
      await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible();
      await expect(staffPage.getByRole('link', { name: 'Ops' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'My tasks' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);

      await staffPage.goto('/admin/payments');
      await expect(staffPage.getByRole('heading', { name: 'Payments' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(staffPage.getByRole('button', { name: 'Reconcile' })).toBeVisible();

      const session = await loginAsStaff(request, staffUser);
      const reconcile = await apiPost(
        request,
        '/api/admin/payments/reconcile',
        { dryRun: true },
        session
      );
      expect(reconcile.status()).not.toBe(403);

      const createTask = await createCalendarTaskViaApi(
        request,
        {
          title: 'accountant blocked',
          taskType: 'pickup',
          startsAt: new Date().toISOString(),
          dueAt: new Date(Date.now() + 3600_000).toISOString(),
        },
        session
      );
      expect(createTask.status).toBe(403);

      const ops = await apiGet(request, '/api/admin/reservations/ops-dashboard', session);
      expect(ops.status()).toBe(403);
    });
  });
});

test.describe("staff-cleaner", () => {
  test.describe('STAFF-004 Cleaner scope', () => {
    test.use({ role: 'cleaner' });
    test.setTimeout(120_000);

    let managerEmail: string | null = null;

    test.afterAll(async () => {
      if (managerEmail) await cleanupTestStaff(managerEmail).catch(() => undefined);
    });

    test('cleaner nav, own tasks, create denied', async ({ staffPage, staffUser, request }) => {
      await insertTestAdmin();
      const manager = await insertTestStaff({ roleSlug: 'manager' });
      managerEmail = manager.email;

      await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(staffPage.getByRole('link', { name: 'Cars' })).toBeVisible();
      await expect(staffPage.getByRole('link', { name: 'Fleet alerts' }).first()).toBeVisible();
      await expect(staffPage.getByRole('link', { name: 'My tasks' })).toBeVisible();

      await expect(staffPage.getByRole('link', { name: 'Ops' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Orders' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);

      const managerSession = await loginAsStaff(request, manager);
      const title = `E2E Clean Task ${Date.now()}`;
      const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const dueAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const created = await createCalendarTaskViaApi(
        request,
        {
          title,
          taskType: 'cleaning',
          assignedToUserId: staffUser.userId,
          startsAt,
          dueAt,
        },
        managerSession
      );
      expect(created.ok, JSON.stringify(created.body)).toBeTruthy();

      await staffPage.goto('/admin/tasks/cleaner');
      await expect(staffPage.getByRole('heading', { name: 'Cleaner tasks' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(staffPage.getByText(title)).toBeVisible({ timeout: 15_000 });

      const cleanerSession = await loginAsStaff(request, staffUser);
      const start = await updateTaskStatusViaApi(
        request,
        created.taskId!,
        'in_progress',
        cleanerSession
      );
      expect(start.ok, JSON.stringify(start.body)).toBeTruthy();

      const createDenied = await createCalendarTaskViaApi(
        request,
        { title: 'nope', taskType: 'cleaning', startsAt, dueAt },
        cleanerSession
      );
      expect(createDenied.status).toBe(403);

      const assignable = await apiGet(request, '/api/admin/calendar/assignable-staff', cleanerSession);
      expect(assignable.status()).toBe(403);

      const ops = await apiGet(request, '/api/admin/reservations/ops-dashboard', cleanerSession);
      expect(ops.status()).toBe(403);

      const refund = await apiPost(
        request,
        '/api/admin/payments/reconcile',
        { dryRun: true },
        cleanerSession
      );
      expect(refund.status()).toBe(403);
    });
  });
});

test.describe("staff-support", () => {
  test.describe('STAFF-006 Support scope', () => {
    test.use({ role: 'support' });
    test.setTimeout(90_000);

    test('support orders/contacts/calendar; no tasks or payments', async ({
      staffPage,
      staffUser,
      request,
    }) => {
      await insertTestAdmin();

      await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
      await expect(staffPage.getByRole('link', { name: 'Contacts' })).toBeVisible();
      await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible();

      await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'My tasks' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);
      await expect(staffPage.getByRole('link', { name: 'Cars' })).toHaveCount(0);

      const session = await loginAsStaff(request, staffUser);
      const orders = await apiGet(request, '/api/admin/orders', session);
      expect(orders.ok(), await orders.text()).toBeTruthy();

      const contacts = await apiGet(request, '/api/admin/contacts', session);
      expect(contacts.ok(), await contacts.text()).toBeTruthy();

      const refund = await apiPost(request, '/api/admin/payments/reconcile', { dryRun: true }, session);
      expect(refund.status()).toBe(403);

      const tasks = await createCalendarTaskViaApi(
        request,
        {
          title: 'support blocked',
          taskType: 'document_check',
          startsAt: new Date().toISOString(),
          dueAt: new Date(Date.now() + 3600_000).toISOString(),
        },
        session
      );
      expect(tasks.status).toBe(403);

      const users = await apiGet(request, '/api/admin/users', session);
      expect(users.status()).toBe(403);
    });
  });
});

test.describe("rbac-receptionist-refund", () => {
  test.describe('AUTH-003 Receptionist ops ok, refund forbidden', () => {
    test.use({ role: 'receptionist' });
    test.setTimeout(90_000);

    let accountantEmail: string | null = null;

    test.afterAll(async () => {
      if (accountantEmail) await cleanupTestStaff(accountantEmail).catch(() => undefined);
    });

    test('receptionist cannot reconcile; accountant can see Reconcile', async ({
      staffPage,
      staffUser,
      request,
      browser,
    }) => {
      await insertTestAdmin();

      await expect(staffPage.getByRole('link', { name: 'Ops' })).toBeVisible({ timeout: 15_000 });
      await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible();
      await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);

      const receptionSession = await loginAsStaff(request, staffUser);
      const forbidden = await apiPost(
        request,
        '/api/admin/payments/reconcile',
        { dryRun: true },
        receptionSession
      );
      expect(forbidden.status()).toBe(403);

      const refundForbidden = await apiPost(
        request,
        '/api/admin/reservations/1/refund',
        { reason: 'rbac_check' },
        receptionSession
      );
      expect(refundForbidden.status()).toBe(403);

      const accountant = await insertTestStaff({ roleSlug: 'accountant' });
      accountantEmail = accountant.email;
      const accountantSession = await loginAsStaff(request, accountant);
      const allowed = await apiPost(
        request,
        '/api/admin/payments/reconcile',
        { dryRun: true },
        accountantSession
      );
      expect(allowed.status()).not.toBe(403);

      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('/login');
      await page.getByLabel(/^email$/i).fill(accountant.email);
      await page.getByLabel(/^password$/i).fill(accountant.password);
      await page.locator('form').getByRole('button', { name: 'Log in' }).click();
      await page.waitForURL(/\/admin/, { timeout: 20_000 });
      await page.goto('/admin/payments');
      await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Reconcile' })).toBeVisible();
      await context.close();
    });
  });
});
