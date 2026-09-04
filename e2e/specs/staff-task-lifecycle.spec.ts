import { expect, test } from '../fixtures/base';
import { ADMIN_BASE_URL } from '../helpers/test-env';
import { apiGet, loginAsAdmin } from '../helpers/csrf';
import { insertTestAdmin } from '../helpers/db';
import {
  STAFF_PASSWORD,
  cleanupTestStaff,
  createCalendarTaskViaApi,
  insertTestStaff,
  listCalendarTasksViaApi,
  loginAsStaff,
  updateTaskStatusViaApi,
} from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });

test.describe("staff-driver-task", () => {
  test.describe('STAFF-001 Manager assigns task; driver own-only', () => {
    test.use({ role: 'driver' });
    test.setTimeout(120_000);

    let managerEmail: string | null = null;
    let otherDriverEmail: string | null = null;

    test.afterAll(async () => {
      if (managerEmail) await cleanupTestStaff(managerEmail).catch(() => undefined);
      if (otherDriverEmail) await cleanupTestStaff(otherDriverEmail).catch(() => undefined);
    });

    test('driver sees assigned task only; cannot mutate others', async ({
      staffPage,
      staffUser,
      request,
    }) => {
      await insertTestAdmin();
      const manager = await insertTestStaff({ roleSlug: 'manager' });
      managerEmail = manager.email;
      const otherDriver = await insertTestStaff({ roleSlug: 'driver' });
      otherDriverEmail = otherDriver.email;

      const managerSession = await loginAsStaff(request, manager);
      const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const dueAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

      const ownTitle = `E2E Driver Own ${Date.now()}`;
      const own = await createCalendarTaskViaApi(
        request,
        {
          title: ownTitle,
          taskType: 'pickup',
          assignedToUserId: staffUser.userId,
          startsAt,
          dueAt,
        },
        managerSession
      );
      expect(own.ok, JSON.stringify(own.body)).toBeTruthy();
      expect(own.taskId).toBeTruthy();

      const otherTitle = `E2E Other Driver ${Date.now()}`;
      const other = await createCalendarTaskViaApi(
        request,
        {
          title: otherTitle,
          taskType: 'delivery',
          assignedToUserId: otherDriver.userId,
          startsAt,
          dueAt,
        },
        managerSession
      );
      expect(other.ok, JSON.stringify(other.body)).toBeTruthy();
      expect(other.taskId).toBeTruthy();

      await staffPage.goto('/admin/tasks/driver');
      await expect(staffPage.getByRole('heading', { name: 'Driver tasks' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(staffPage.getByText(ownTitle)).toBeVisible({ timeout: 15_000 });
      await expect(staffPage.getByText(otherTitle)).toHaveCount(0);

      await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);
      await expect(staffPage.getByRole('button', { name: 'Create task' })).toHaveCount(0);

      await staffPage.goto('/admin/tasks');
      await expect(staffPage).toHaveURL(/\/admin\/?$/);

      const driverSession = await loginAsStaff(request, staffUser);
      const startOwn = await updateTaskStatusViaApi(
        request,
        own.taskId!,
        'in_progress',
        driverSession
      );
      expect(startOwn.ok, JSON.stringify(startOwn.body)).toBeTruthy();

      const mutateOther = await updateTaskStatusViaApi(
        request,
        other.taskId!,
        'in_progress',
        driverSession
      );
      expect(mutateOther.status).toBe(403);

      const createDenied = await createCalendarTaskViaApi(
        request,
        { title: 'Driver cannot create', taskType: 'pickup', startsAt, dueAt },
        driverSession
      );
      expect(createDenied.status).toBe(403);

      const assignable = await apiGet(
        request,
        '/api/admin/calendar/assignable-staff',
        driverSession
      );
      expect(assignable.status()).toBe(403);
    });
  });
});

test.describe("manager-task-lifecycle", () => {
  test.describe('STAFF-002 Manager full task lifecycle', () => {
    test.use({ role: 'manager' });
    test.setTimeout(120_000);

    let driverEmail: string | null = null;

    test.afterAll(async () => {
      if (driverEmail) await cleanupTestStaff(driverEmail).catch(() => undefined);
    });

    test('manager creates, assigns, starts, and completes a task', async ({
      staffPage,
      staffUser,
      request,
    }) => {
      await insertTestAdmin();
      const driver = await insertTestStaff({ roleSlug: 'driver' });
      driverEmail = driver.email;

      const title = `E2E Manager Lifecycle ${Date.now()}`;
      const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const dueAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

      const managerSession = await loginAsStaff(request, staffUser);
      const created = await createCalendarTaskViaApi(
        request,
        {
          title,
          taskType: 'pickup',
          assignedToUserId: driver.userId,
          startsAt,
          dueAt,
        },
        managerSession
      );
      expect(created.ok, JSON.stringify(created.body)).toBeTruthy();
      expect(created.taskId).toBeTruthy();

      const started = await updateTaskStatusViaApi(
        request,
        created.taskId!,
        'in_progress',
        managerSession
      );
      expect(started.ok, JSON.stringify(started.body)).toBeTruthy();

      const completed = await updateTaskStatusViaApi(
        request,
        created.taskId!,
        'completed',
        managerSession
      );
      expect(completed.ok, JSON.stringify(completed.body)).toBeTruthy();

      await staffPage.goto('/admin/tasks');
      await expect(staffPage.getByRole('heading', { name: 'Task board' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(staffPage.getByRole('button', { name: 'Create task' })).toBeVisible();
      await expect(staffPage.getByText(title)).toBeVisible({ timeout: 15_000 });
    });
  });
});

test.describe("manager-task-fail-reopen", () => {
  test.describe('Manager task fail → reopen (99)', () => {
    test.use({ role: 'manager' });
    test.setTimeout(180_000);

    let driverEmail: string | null = null;

    test.afterAll(async () => {
      if (driverEmail) await cleanupTestStaff(driverEmail).catch(() => undefined);
    });

    test('fail then reopen assign → start → complete', async ({
      staffPage,
      staffUser,
      browser,
      request,
    }) => {
      await insertTestAdmin();
      const driver = await insertTestStaff({ roleSlug: 'driver' });
      driverEmail = driver.email;

      const title = `E2E Fail Reopen ${Date.now()}`;
      const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const dueAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

      const managerSession = await loginAsStaff(request, staffUser);
      const created = await createCalendarTaskViaApi(
        request,
        {
          title,
          taskType: 'pickup',
          assignedToUserId: driver.userId,
          startsAt,
          dueAt,
        },
        managerSession
      );
      expect(created.ok, JSON.stringify(created.body)).toBeTruthy();
      expect(created.taskId).toBeTruthy();
      const taskId = created.taskId!;

      const driverCtx = await browser.newContext({ baseURL: ADMIN_BASE_URL });
      const driverPage = await driverCtx.newPage();
      try {
        await driverPage.goto('/login');
        await driverPage.getByLabel('Email').fill(driver.email);
        await driverPage.getByLabel('Password', { exact: true }).fill(STAFF_PASSWORD);
        await driverPage.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
        await driverPage.waitForURL(/\/admin/, { timeout: 15_000 });
        await driverPage.goto('/admin/tasks/driver');
        const card = driverPage.getByTestId(`task-card-${taskId}`);
        await expect(card).toBeVisible({ timeout: 15_000 });
        await card.getByRole('button', { name: 'Start' }).click();
        await expect(driverPage.getByText('Task updated')).toBeVisible({ timeout: 15_000 });
        await card.getByRole('button', { name: 'Fail' }).click();
        await expect(driverPage.getByText('Task updated')).toBeVisible({ timeout: 15_000 });
      } finally {
        await driverCtx.close();
      }

      await staffPage.goto('/admin/tasks');
      await expect(staffPage.getByRole('heading', { name: 'Task board' })).toBeVisible({
        timeout: 15_000,
      });
      const managerCard = staffPage.getByTestId(`task-card-${taskId}`);
      await expect(managerCard).toBeVisible({ timeout: 15_000 });
      await expect(managerCard.getByText(/Failed/i)).toBeVisible();

      await managerCard.getByRole('button', { name: 'Reopen assigned' }).click();
      await expect(staffPage.getByText('Task updated')).toBeVisible({ timeout: 15_000 });

      const started = await updateTaskStatusViaApi(request, taskId, 'in_progress', managerSession);
      expect(started.ok, JSON.stringify(started.body)).toBeTruthy();
      const completed = await updateTaskStatusViaApi(request, taskId, 'completed', managerSession);
      expect(completed.ok, JSON.stringify(completed.body)).toBeTruthy();

      await staffPage.reload();
      await expect(staffPage.getByTestId(`task-card-${taskId}`).getByText(/Completed/i)).toBeVisible({
        timeout: 15_000,
      });

      const listed = await listCalendarTasksViaApi(
        request,
        { includeCancelled: 'true' },
        managerSession
      );
      expect(listed.ok).toBeTruthy();
      const tasks = listed.body?.data?.tasks || listed.body?.tasks || [];
      const row = (tasks as Array<{ id: number | string; status: string; title: string }>).find(
        (t) => Number(t.id) === Number(taskId) || t.title === title
      );
      expect(row?.status).toBe('completed');
    });
  });
});
