import { test as base, type Browser, type Page } from '@playwright/test';
import { ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from '../helpers/test-env';
import { insertTestAdmin } from '../helpers/db';
import {
  cleanupTestStaff,
  insertTestStaff,
  type StaffRoleSlug,
  type TestStaffUser,
} from '../helpers/rbac';

async function loginViaUi(
  browser: Browser,
  credentials: { email: string; password: string }
): Promise<{ page: Page; context: Awaited<ReturnType<Browser['newContext']>> }> {
  const context = await browser.newContext({ baseURL: ADMIN_BASE_URL });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel(/^email$/i).fill(credentials.email);
  await page.getByLabel(/^password$/i).fill(credentials.password);
  await page.locator('form').getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(/\/admin/, { timeout: 20_000 });
  return { page, context };
}

export const test = base.extend<{
  adminPage: Page;
  role: StaffRoleSlug;
  staffUser: TestStaffUser;
  staffPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    await insertTestAdmin();
    const { page, context } = await loginViaUi(browser, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },

  role: ['driver', { option: true }],

  staffUser: async ({ role }, use) => {
    await insertTestAdmin();
    const user = await insertTestStaff({ roleSlug: role });
    try {
      await use(user);
    } finally {
      await cleanupTestStaff(user.email).catch(() => undefined);
    }
  },

  staffPage: async ({ browser, staffUser }, use) => {
    const { page, context } = await loginViaUi(browser, {
      email: staffUser.email,
      password: staffUser.password,
    });
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
});

export { expect } from '@playwright/test';
export { cookiesFromSession, loginAsAdmin, loginApi } from '../helpers/csrf';
export type { StaffRoleSlug, TestStaffUser };
export type { ApiSession } from '../helpers/csrf';
