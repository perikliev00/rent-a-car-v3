// Import named exports from '@playwright/test'.
import { test as base, type Browser, type Page } from '@playwright/test';
// Import named exports from '../helpers/test-env'.
import { ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from '../helpers/test-env';
// Import named exports from '../helpers/db'.
import { insertTestAdmin } from '../helpers/db';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  insertTestStaff,
  // Declare the StaffRoleSlug TypeScript type alias.
  type StaffRoleSlug,
  // Declare the TestStaffUser TypeScript type alias.
  type TestStaffUser,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/rbac';

// Define the async function loginViaUi.
async function loginViaUi(
  // Provide the browser field value.
  browser: Browser,
  // Provide the credentials field value.
  credentials: { email: string; password: string }
// Continue the surrounding logic with this statement.
): Promise<{ page: Page; context: Awaited<ReturnType<Browser['newContext']>> }> {
  // Create the context constant.
  const context = await browser.newContext({ baseURL: ADMIN_BASE_URL });
  // Create the page constant.
  const page = await context.newPage();
  // Wait until the asynchronous operation resolves.
  await page.goto('/login');
  // Wait until the asynchronous operation resolves.
  await page.getByLabel(/^email$/i).fill(credentials.email);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel(/^password$/i).fill(credentials.password);
  // Wait until the asynchronous operation resolves.
  await page.locator('form').getByRole('button', { name: 'Log in' }).click();
  // Wait until the asynchronous operation resolves.
  await page.waitForURL(/\/admin/, { timeout: 20_000 });
  // Return the resulting value to the caller.
  return { page, context };
}

// Export the test const.
export const test = base.extend<{
  // Provide the admin page field value.
  adminPage: Page;
  // Provide the role field value.
  role: StaffRoleSlug;
  // Provide the staff user field value.
  staffUser: TestStaffUser;
  // Provide the staff page field value.
  staffPage: Page;
// Continue the surrounding logic with this statement.
}>({
  // Provide the admin page field value.
  adminPage: async ({ browser }, use) => {
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
    // Destructure object properties into local variables.
    const { page, context } = await loginViaUi(browser, {
      // Provide the email field value.
      email: ADMIN_EMAIL,
      // Provide the password field value.
      password: ADMIN_PASSWORD,
    });
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await use(page);
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await context.close();
    }
  },

  // Provide the role field value.
  role: ['driver', { option: true }],

  // Provide the staff user field value.
  staffUser: async ({ role }, use) => {
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
    // Create the user constant.
    const user = await insertTestStaff({ roleSlug: role });
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await use(user);
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupTestStaff(user.email).catch(() => undefined);
    }
  },

  // Provide the staff page field value.
  staffPage: async ({ browser, staffUser }, use) => {
    // Destructure object properties into local variables.
    const { page, context } = await loginViaUi(browser, {
      // Provide the email field value.
      email: staffUser.email,
      // Provide the password field value.
      password: staffUser.password,
    });
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await use(page);
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await context.close();
    }
  },
});

// Re-export the listed bindings.
export { expect } from '@playwright/test';
// Re-export the listed bindings.
export { cookiesFromSession, loginAsAdmin, loginApi } from '../helpers/csrf';
// Contribute this line to the enclosing declaration or statement.
export type { StaffRoleSlug, TestStaffUser };
// Contribute this line to the enclosing declaration or statement.
export type { ApiSession } from '../helpers/csrf';
