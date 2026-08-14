import { test, expect } from '../fixtures/base';
import { insertTestAdmin } from '../helpers/db';
import {
  cleanupTestStaff,
  createCalendarTaskViaApi,
  insertTestStaff,
  loginAsStaff,
  listCalendarTasksViaApi,
  STAFF_PASSWORD,
  updateTaskStatusViaApi,
} from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });
test.use({ role: 'manager' });

test.describe('Manager task fail → reopen (99)', () => {
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

    const driverCtx = await browser.newContext();
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
