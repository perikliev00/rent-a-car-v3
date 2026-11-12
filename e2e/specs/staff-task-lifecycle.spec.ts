// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/test-env'.
import { ADMIN_BASE_URL } from '../helpers/test-env';
// Import named exports from '../helpers/csrf'.
import { apiGet, loginAsAdmin } from '../helpers/csrf';
// Import named exports from '../helpers/db'.
import { insertTestAdmin } from '../helpers/db';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  STAFF_PASSWORD,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  createCalendarTaskViaApi,
  // Contribute this line to the enclosing declaration or statement.
  insertTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  listCalendarTasksViaApi,
  // Contribute this line to the enclosing declaration or statement.
  loginAsStaff,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatusViaApi,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/rbac';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("staff-driver-task", () => {
  // Call test.describe to perform this step.
  test.describe('STAFF-001 Manager assigns task; driver own-only', () => {
    // Call test.use to perform this step.
    test.use({ role: 'driver' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Continue the surrounding logic with this statement.
    let managerEmail: string | null = null;
    // Continue the surrounding logic with this statement.
    let otherDriverEmail: string | null = null;

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (managerEmail) await cleanupTestStaff(managerEmail).catch(() => undefined);
      // Evaluate the condition and enter the branch when it is true.
      if (otherDriverEmail) await cleanupTestStaff(otherDriverEmail).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('driver sees assigned task only; cannot mutate others', async ({
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
      // Create the manager constant.
      const manager = await insertTestStaff({ roleSlug: 'manager' });
      // Update managerEmail with the right-hand side value.
      managerEmail = manager.email;
      // Create the other driver constant.
      const otherDriver = await insertTestStaff({ roleSlug: 'driver' });
      // Update otherDriverEmail with the right-hand side value.
      otherDriverEmail = otherDriver.email;

      // Create the manager session constant.
      const managerSession = await loginAsStaff(request, manager);
      // Create the starts at constant.
      const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      // Create the due at constant.
      const dueAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

      // Create the own title constant.
      const ownTitle = `E2E Driver Own ${Date.now()}`;
      // Create the own constant.
      const own = await createCalendarTaskViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        {
          // Provide the title field value.
          title: ownTitle,
          // Provide the task type field value.
          taskType: 'pickup',
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
      expect(own.ok, JSON.stringify(own.body)).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(own.taskId).toBeTruthy();

      // Create the other title constant.
      const otherTitle = `E2E Other Driver ${Date.now()}`;
      // Create the other constant.
      const other = await createCalendarTaskViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        {
          // Provide the title field value.
          title: otherTitle,
          // Provide the task type field value.
          taskType: 'delivery',
          // Provide the assigned to user id field value.
          assignedToUserId: otherDriver.userId,
          // Contribute this line to the enclosing declaration or statement.
          startsAt,
          // Contribute this line to the enclosing declaration or statement.
          dueAt,
        },
        // Reference the identifier used by the enclosing expression.
        managerSession
      );
      // Assert that the value matches the intended expectation.
      expect(other.ok, JSON.stringify(other.body)).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(other.taskId).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await staffPage.goto('/admin/tasks/driver');
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('heading', { name: 'Driver tasks' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByText(ownTitle)).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByText(otherTitle)).toHaveCount(0);

      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('button', { name: 'Create task' })).toHaveCount(0);

      // Wait until the asynchronous operation resolves.
      await staffPage.goto('/admin/tasks');
      // Wait until the asynchronous operation resolves.
      await expect(staffPage).toHaveURL(/\/admin\/?$/);

      // Create the driver session constant.
      const driverSession = await loginAsStaff(request, staffUser);
      // Create the start own constant.
      const startOwn = await updateTaskStatusViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        own.taskId!,
        // Supply the literal value used by the enclosing expression.
        'in_progress',
        // Reference the identifier used by the enclosing expression.
        driverSession
      );
      // Assert that the value matches the intended expectation.
      expect(startOwn.ok, JSON.stringify(startOwn.body)).toBeTruthy();

      // Create the mutate other constant.
      const mutateOther = await updateTaskStatusViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        other.taskId!,
        // Supply the literal value used by the enclosing expression.
        'in_progress',
        // Reference the identifier used by the enclosing expression.
        driverSession
      );
      // Assert that the value matches the intended expectation.
      expect(mutateOther.status).toBe(403);

      // Create the create denied constant.
      const createDenied = await createCalendarTaskViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        { title: 'Driver cannot create', taskType: 'pickup', startsAt, dueAt },
        // Reference the identifier used by the enclosing expression.
        driverSession
      );
      // Assert that the value matches the intended expectation.
      expect(createDenied.status).toBe(403);

      // Create the assignable constant.
      const assignable = await apiGet(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Supply the literal value used by the enclosing expression.
        '/api/admin/calendar/assignable-staff',
        // Reference the identifier used by the enclosing expression.
        driverSession
      );
      // Assert that the value matches the intended expectation.
      expect(assignable.status()).toBe(403);
    });
  });
});

// Call test.describe to perform this step.
test.describe("manager-task-lifecycle", () => {
  // Call test.describe to perform this step.
  test.describe('STAFF-002 Manager full task lifecycle', () => {
    // Call test.use to perform this step.
    test.use({ role: 'manager' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Continue the surrounding logic with this statement.
    let driverEmail: string | null = null;

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (driverEmail) await cleanupTestStaff(driverEmail).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('manager creates, assigns, starts, and completes a task', async ({
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
      // Create the driver constant.
      const driver = await insertTestStaff({ roleSlug: 'driver' });
      // Update driverEmail with the right-hand side value.
      driverEmail = driver.email;

      // Create the title constant.
      const title = `E2E Manager Lifecycle ${Date.now()}`;
      // Create the starts at constant.
      const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      // Create the due at constant.
      const dueAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

      // Create the manager session constant.
      const managerSession = await loginAsStaff(request, staffUser);
      // Create the created constant.
      const created = await createCalendarTaskViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        {
          // Contribute this line to the enclosing declaration or statement.
          title,
          // Provide the task type field value.
          taskType: 'pickup',
          // Provide the assigned to user id field value.
          assignedToUserId: driver.userId,
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
      // Assert that the value matches the intended expectation.
      expect(created.taskId).toBeTruthy();

      // Create the started constant.
      const started = await updateTaskStatusViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        created.taskId!,
        // Supply the literal value used by the enclosing expression.
        'in_progress',
        // Reference the identifier used by the enclosing expression.
        managerSession
      );
      // Assert that the value matches the intended expectation.
      expect(started.ok, JSON.stringify(started.body)).toBeTruthy();

      // Create the completed constant.
      const completed = await updateTaskStatusViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        created.taskId!,
        // Supply the literal value used by the enclosing expression.
        'completed',
        // Reference the identifier used by the enclosing expression.
        managerSession
      );
      // Assert that the value matches the intended expectation.
      expect(completed.ok, JSON.stringify(completed.body)).toBeTruthy();

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
      await expect(staffPage.getByText(title)).toBeVisible({ timeout: 15_000 });
    });
  });
});

// Call test.describe to perform this step.
test.describe("manager-task-fail-reopen", () => {
  // Call test.describe to perform this step.
  test.describe('Manager task fail → reopen (99)', () => {
    // Call test.use to perform this step.
    test.use({ role: 'manager' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Continue the surrounding logic with this statement.
    let driverEmail: string | null = null;

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (driverEmail) await cleanupTestStaff(driverEmail).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('fail then reopen assign → start → complete', async ({
      // Contribute this line to the enclosing declaration or statement.
      staffPage,
      // Contribute this line to the enclosing declaration or statement.
      staffUser,
      // Contribute this line to the enclosing declaration or statement.
      browser,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await insertTestAdmin();
      // Create the driver constant.
      const driver = await insertTestStaff({ roleSlug: 'driver' });
      // Update driverEmail with the right-hand side value.
      driverEmail = driver.email;

      // Create the title constant.
      const title = `E2E Fail Reopen ${Date.now()}`;
      // Create the starts at constant.
      const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      // Create the due at constant.
      const dueAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

      // Create the manager session constant.
      const managerSession = await loginAsStaff(request, staffUser);
      // Create the created constant.
      const created = await createCalendarTaskViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        {
          // Contribute this line to the enclosing declaration or statement.
          title,
          // Provide the task type field value.
          taskType: 'pickup',
          // Provide the assigned to user id field value.
          assignedToUserId: driver.userId,
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
      // Assert that the value matches the intended expectation.
      expect(created.taskId).toBeTruthy();
      // Create the task id constant.
      const taskId = created.taskId!;

      // Create the driver ctx constant.
      const driverCtx = await browser.newContext({ baseURL: ADMIN_BASE_URL });
      // Create the driver page constant.
      const driverPage = await driverCtx.newPage();
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await driverPage.goto('/login');
        // Wait until the asynchronous operation resolves.
        await driverPage.getByLabel('Email').fill(driver.email);
        // Wait until the asynchronous operation resolves.
        await driverPage.getByLabel('Password', { exact: true }).fill(STAFF_PASSWORD);
        // Wait until the asynchronous operation resolves.
        await driverPage.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
        // Wait until the asynchronous operation resolves.
        await driverPage.waitForURL(/\/admin/, { timeout: 15_000 });
        // Wait until the asynchronous operation resolves.
        await driverPage.goto('/admin/tasks/driver');
        // Create the card constant.
        const card = driverPage.getByTestId(`task-card-${taskId}`);
        // Wait until the asynchronous operation resolves.
        await expect(card).toBeVisible({ timeout: 15_000 });
        // Wait until the asynchronous operation resolves.
        await card.getByRole('button', { name: 'Start' }).click();
        // Wait until the asynchronous operation resolves.
        await expect(driverPage.getByText('Task updated')).toBeVisible({ timeout: 15_000 });
        // Wait until the asynchronous operation resolves.
        await card.getByRole('button', { name: 'Fail' }).click();
        // Wait until the asynchronous operation resolves.
        await expect(driverPage.getByText('Task updated')).toBeVisible({ timeout: 15_000 });
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Wait until the asynchronous operation resolves.
        await driverCtx.close();
      }

      // Wait until the asynchronous operation resolves.
      await staffPage.goto('/admin/tasks');
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('heading', { name: 'Task board' })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Create the manager card constant.
      const managerCard = staffPage.getByTestId(`task-card-${taskId}`);
      // Wait until the asynchronous operation resolves.
      await expect(managerCard).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(managerCard.getByText(/Failed/i)).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await managerCard.getByRole('button', { name: 'Reopen assigned' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByText('Task updated')).toBeVisible({ timeout: 15_000 });

      // Create the started constant.
      const started = await updateTaskStatusViaApi(request, taskId, 'in_progress', managerSession);
      // Assert that the value matches the intended expectation.
      expect(started.ok, JSON.stringify(started.body)).toBeTruthy();
      // Create the completed constant.
      const completed = await updateTaskStatusViaApi(request, taskId, 'completed', managerSession);
      // Assert that the value matches the intended expectation.
      expect(completed.ok, JSON.stringify(completed.body)).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await staffPage.reload();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByTestId(`task-card-${taskId}`).getByText(/Completed/i)).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Create the listed constant.
      const listed = await listCalendarTasksViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        { includeCancelled: 'true' },
        // Reference the identifier used by the enclosing expression.
        managerSession
      );
      // Assert that the value matches the intended expectation.
      expect(listed.ok).toBeTruthy();
      // Create the tasks constant.
      const tasks = listed.body?.data?.tasks || listed.body?.tasks || [];
      // Create the row constant.
      const row = (tasks as Array<{ id: number | string; status: string; title: string }>).find(
        // Continue the surrounding logic with this statement.
        (t) => Number(t.id) === Number(taskId) || t.title === title
      );
      // Assert that the value matches the intended expectation.
      expect(row?.status).toBe('completed');
    });
  });
});
