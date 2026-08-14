import { test, expect } from '../fixtures/base';
import { insertTestAdmin } from '../helpers/db';
import {
  cleanupTestStaff,
  createCalendarTaskViaApi,
  insertTestStaff,
  loginAsStaff,
  updateTaskStatusViaApi,
} from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });
test.use({ role: 'manager' });

test.describe('STAFF-002 Manager full task lifecycle', () => {
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
