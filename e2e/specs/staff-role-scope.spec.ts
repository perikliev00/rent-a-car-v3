// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/test-env'.
import { ADMIN_BASE_URL } from '../helpers/test-env';
// Import named exports from '../helpers/csrf'.
import { apiGet, apiPost } from '../helpers/csrf';
// Import named exports from '../helpers/db'.
import { insertTestAdmin } from '../helpers/db';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  createCalendarTaskViaApi,
  // Contribute this line to the enclosing declaration or statement.
  insertTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  loginAsStaff,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatusViaApi,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/rbac';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("staff-receptionist", () => {
  // Call test.describe to perform this step.
  test.describe('STAFF-003 Receptionist scope', () => {
    // Call test.use to perform this step.
    test.use({ role: 'receptionist' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

    // Define a single test case and its expectations.
    test('receptionist nav and API scope', async ({ staffPage, staffUser, request }) => {
      // Wait until the asynchronous operation resolves.
      await insertTestAdmin();

      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Ops' })).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Contacts' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'My tasks' })).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Roles' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Cars' })).toHaveCount(0);

      // Wait until the asynchronous operation resolves.
      await staffPage.goto('/admin/tasks');
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('heading', { name: 'Task board' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('button', { name: 'Create task' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await staffPage.getByRole('button', { name: 'Create task' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('heading', { name: 'Create task' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByLabel('Assignee', { exact: true })).toHaveCount(0);

      // Create the session constant.
      const session = await loginAsStaff(request, staffUser);
      // Create the starts at constant.
      const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      // Create the due at constant.
      const dueAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      // Create the created constant.
      const created = await createCalendarTaskViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Continue the surrounding logic with this statement.
        { title: `E2E Reception Task ${Date.now()}`, taskType: 'document_check', startsAt, dueAt },
        // Reference the identifier used by the enclosing expression.
        session
      );
      // Assert that the value matches the intended expectation.
      expect(created.ok, JSON.stringify(created.body)).toBeTruthy();

      // Create the assignable constant.
      const assignable = await apiGet(request, '/api/admin/calendar/assignable-staff', session);
      // Assert that the value matches the intended expectation.
      expect(assignable.status()).toBe(403);

      // Create the refund constant.
      const refund = await apiPost(request, '/api/admin/payments/reconcile', { dryRun: true }, session);
      // Assert that the value matches the intended expectation.
      expect(refund.status()).toBe(403);

      // Create the users constant.
      const users = await apiGet(request, '/api/admin/users', session);
      // Assert that the value matches the intended expectation.
      expect(users.status()).toBe(403);
    });
  });
});

// Call test.describe to perform this step.
test.describe("staff-accountant", () => {
  // Call test.describe to perform this step.
  test.describe('STAFF-005 Accountant scope', () => {
    // Call test.use to perform this step.
    test.use({ role: 'accountant' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

    // Define a single test case and its expectations.
    test('accountant payments/orders; no ops or tasks', async ({ staffPage, staffUser, request }) => {
      // Wait until the asynchronous operation resolves.
      await insertTestAdmin();

      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Payments' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Ops' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'My tasks' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);

      // Wait until the asynchronous operation resolves.
      await staffPage.goto('/admin/payments');
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('heading', { name: 'Payments' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('button', { name: 'Reconcile' })).toBeVisible();

      // Create the session constant.
      const session = await loginAsStaff(request, staffUser);
      // Create the reconcile constant.
      const reconcile = await apiPost(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Supply the literal value used by the enclosing expression.
        '/api/admin/payments/reconcile',
        // Contribute this line to the enclosing declaration or statement.
        { dryRun: true },
        // Reference the identifier used by the enclosing expression.
        session
      );
      // Assert that the value matches the intended expectation.
      expect(reconcile.status()).not.toBe(403);

      // Create the create task constant.
      const createTask = await createCalendarTaskViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        {
          // Provide the title field value.
          title: 'accountant blocked',
          // Provide the task type field value.
          taskType: 'pickup',
          // Provide the starts at field value.
          startsAt: new Date().toISOString(),
          // Provide the due at field value.
          dueAt: new Date(Date.now() + 3600_000).toISOString(),
        },
        // Reference the identifier used by the enclosing expression.
        session
      );
      // Assert that the value matches the intended expectation.
      expect(createTask.status).toBe(403);

      // Create the ops constant.
      const ops = await apiGet(request, '/api/admin/reservations/ops-dashboard', session);
      // Assert that the value matches the intended expectation.
      expect(ops.status()).toBe(403);
    });
  });
});

// Call test.describe to perform this step.
test.describe("staff-cleaner", () => {
  // Call test.describe to perform this step.
  test.describe('STAFF-004 Cleaner scope', () => {
    // Call test.use to perform this step.
    test.use({ role: 'cleaner' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Continue the surrounding logic with this statement.
    let managerEmail: string | null = null;

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (managerEmail) await cleanupTestStaff(managerEmail).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('cleaner nav, own tasks, create denied', async ({ staffPage, staffUser, request }) => {
      // Wait until the asynchronous operation resolves.
      await insertTestAdmin();
      // Create the manager constant.
      const manager = await insertTestStaff({ roleSlug: 'manager' });
      // Update managerEmail with the right-hand side value.
      managerEmail = manager.email;

      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Cars' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Fleet alerts' }).first()).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'My tasks' })).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Ops' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Orders' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);

      // Create the manager session constant.
      const managerSession = await loginAsStaff(request, manager);
      // Create the title constant.
      const title = `E2E Clean Task ${Date.now()}`;
      // Create the starts at constant.
      const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      // Create the due at constant.
      const dueAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      // Create the created constant.
      const created = await createCalendarTaskViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        {
          // Contribute this line to the enclosing declaration or statement.
          title,
          // Provide the task type field value.
          taskType: 'cleaning',
          // Provide the assigned to user id field value.
          assignedToUserId: staffUser.userId,
          // Contribute this line to the enclosing declaration or statement.
          startsAt,
          // Contribute this line to the enclosing declaration or statement.
          dueAt,
        },
        // Reference the identifier used by the enclosing expression.
        managerSession
      );
      // Assert that the value matches the intended expectation.
      expect(created.ok, JSON.stringify(created.body)).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await staffPage.goto('/admin/tasks/cleaner');
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('heading', { name: 'Cleaner tasks' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByText(title)).toBeVisible({ timeout: 15_000 });

      // Create the cleaner session constant.
      const cleanerSession = await loginAsStaff(request, staffUser);
      // Create the start constant.
      const start = await updateTaskStatusViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        created.taskId!,
        // Supply the literal value used by the enclosing expression.
        'in_progress',
        // Reference the identifier used by the enclosing expression.
        cleanerSession
      );
      // Assert that the value matches the intended expectation.
      expect(start.ok, JSON.stringify(start.body)).toBeTruthy();

      // Create the create denied constant.
      const createDenied = await createCalendarTaskViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        { title: 'nope', taskType: 'cleaning', startsAt, dueAt },
        // Reference the identifier used by the enclosing expression.
        cleanerSession
      );
      // Assert that the value matches the intended expectation.
      expect(createDenied.status).toBe(403);

      // Create the assignable constant.
      const assignable = await apiGet(request, '/api/admin/calendar/assignable-staff', cleanerSession);
      // Assert that the value matches the intended expectation.
      expect(assignable.status()).toBe(403);

      // Create the ops constant.
      const ops = await apiGet(request, '/api/admin/reservations/ops-dashboard', cleanerSession);
      // Assert that the value matches the intended expectation.
      expect(ops.status()).toBe(403);

      // Create the refund constant.
      const refund = await apiPost(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Supply the literal value used by the enclosing expression.
        '/api/admin/payments/reconcile',
        // Contribute this line to the enclosing declaration or statement.
        { dryRun: true },
        // Reference the identifier used by the enclosing expression.
        cleanerSession
      );
      // Assert that the value matches the intended expectation.
      expect(refund.status()).toBe(403);
    });
  });
});

// Call test.describe to perform this step.
test.describe("staff-support", () => {
  // Call test.describe to perform this step.
  test.describe('STAFF-006 Support scope', () => {
    // Call test.use to perform this step.
    test.use({ role: 'support' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

    // Define a single test case and its expectations.
    test('support orders/contacts/calendar; no tasks or payments', async ({
      // Contribute this line to the enclosing declaration or statement.
      staffPage,
      // Contribute this line to the enclosing declaration or statement.
      staffUser,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await insertTestAdmin();

      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Contacts' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'My tasks' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Cars' })).toHaveCount(0);

      // Create the session constant.
      const session = await loginAsStaff(request, staffUser);
      // Create the orders constant.
      const orders = await apiGet(request, '/api/admin/orders', session);
      // Assert that the value matches the intended expectation.
      expect(orders.ok(), await orders.text()).toBeTruthy();

      // Create the contacts constant.
      const contacts = await apiGet(request, '/api/admin/contacts', session);
      // Assert that the value matches the intended expectation.
      expect(contacts.ok(), await contacts.text()).toBeTruthy();

      // Create the refund constant.
      const refund = await apiPost(request, '/api/admin/payments/reconcile', { dryRun: true }, session);
      // Assert that the value matches the intended expectation.
      expect(refund.status()).toBe(403);

      // Create the tasks constant.
      const tasks = await createCalendarTaskViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        {
          // Provide the title field value.
          title: 'support blocked',
          // Provide the task type field value.
          taskType: 'document_check',
          // Provide the starts at field value.
          startsAt: new Date().toISOString(),
          // Provide the due at field value.
          dueAt: new Date(Date.now() + 3600_000).toISOString(),
        },
        // Reference the identifier used by the enclosing expression.
        session
      );
      // Assert that the value matches the intended expectation.
      expect(tasks.status).toBe(403);

      // Create the users constant.
      const users = await apiGet(request, '/api/admin/users', session);
      // Assert that the value matches the intended expectation.
      expect(users.status()).toBe(403);
    });
  });
});

// Call test.describe to perform this step.
test.describe("rbac-receptionist-refund", () => {
  // Call test.describe to perform this step.
  test.describe('AUTH-003 Receptionist ops ok, refund forbidden', () => {
    // Call test.use to perform this step.
    test.use({ role: 'receptionist' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

    // Continue the surrounding logic with this statement.
    let accountantEmail: string | null = null;

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (accountantEmail) await cleanupTestStaff(accountantEmail).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('receptionist cannot reconcile; accountant can see Reconcile', async ({
      // Contribute this line to the enclosing declaration or statement.
      staffPage,
      // Contribute this line to the enclosing declaration or statement.
      staffUser,
      // Contribute this line to the enclosing declaration or statement.
      request,
      // Contribute this line to the enclosing declaration or statement.
      browser,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await insertTestAdmin();

      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Ops' })).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);

      // Create the reception session constant.
      const receptionSession = await loginAsStaff(request, staffUser);
      // Create the forbidden constant.
      const forbidden = await apiPost(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Supply the literal value used by the enclosing expression.
        '/api/admin/payments/reconcile',
        // Contribute this line to the enclosing declaration or statement.
        { dryRun: true },
        // Reference the identifier used by the enclosing expression.
        receptionSession
      );
      // Assert that the value matches the intended expectation.
      expect(forbidden.status()).toBe(403);

      // Create the refund forbidden constant.
      const refundForbidden = await apiPost(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Supply the literal value used by the enclosing expression.
        '/api/admin/reservations/1/refund',
        // Contribute this line to the enclosing declaration or statement.
        { reason: 'rbac_check' },
        // Reference the identifier used by the enclosing expression.
        receptionSession
      );
      // Assert that the value matches the intended expectation.
      expect(refundForbidden.status()).toBe(403);

      // Create the accountant constant.
      const accountant = await insertTestStaff({ roleSlug: 'accountant' });
      // Update accountantEmail with the right-hand side value.
      accountantEmail = accountant.email;
      // Create the accountant session constant.
      const accountantSession = await loginAsStaff(request, accountant);
      // Create the allowed constant.
      const allowed = await apiPost(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Supply the literal value used by the enclosing expression.
        '/api/admin/payments/reconcile',
        // Contribute this line to the enclosing declaration or statement.
        { dryRun: true },
        // Reference the identifier used by the enclosing expression.
        accountantSession
      );
      // Assert that the value matches the intended expectation.
      expect(allowed.status()).not.toBe(403);

      // Create the context constant.
      const context = await browser.newContext({ baseURL: ADMIN_BASE_URL });
      // Create the page constant.
      const page = await context.newPage();
      // Wait until the asynchronous operation resolves.
      await page.goto('/login');
      // Wait until the asynchronous operation resolves.
      await page.getByLabel(/^email$/i).fill(accountant.email);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel(/^password$/i).fill(accountant.password);
      // Wait until the asynchronous operation resolves.
      await page.locator('form').getByRole('button', { name: 'Log in' }).click();
      // Wait until the asynchronous operation resolves.
      await page.waitForURL(/\/admin/, { timeout: 20_000 });
      // Wait until the asynchronous operation resolves.
      await page.goto('/admin/payments');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('button', { name: 'Reconcile' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await context.close();
    });
  });
});
