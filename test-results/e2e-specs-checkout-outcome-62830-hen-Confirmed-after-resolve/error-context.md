# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\specs\checkout-outcomes.spec.ts >> checkout-success-processing >> Checkout success processing then confirmed (88) >> shows Payment Received while stuck, then Confirmed after resolve
- Location: e2e\specs\checkout-outcomes.spec.ts:50:9

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5174/login
Call log:
  - navigating to "http://localhost:5174/login", waiting until "load"

```

# Test source

```ts
  1  | import { test as base, type Browser, type Page } from '@playwright/test';
  2  | import { ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from '../helpers/test-env';
  3  | import { insertTestAdmin } from '../helpers/db';
  4  | import {
  5  |   cleanupTestStaff,
  6  |   insertTestStaff,
  7  |   type StaffRoleSlug,
  8  |   type TestStaffUser,
  9  | } from '../helpers/rbac';
  10 | 
  11 | async function loginViaUi(
  12 |   browser: Browser,
  13 |   credentials: { email: string; password: string }
  14 | ): Promise<{ page: Page; context: Awaited<ReturnType<Browser['newContext']>> }> {
  15 |   const context = await browser.newContext({ baseURL: ADMIN_BASE_URL });
  16 |   const page = await context.newPage();
> 17 |   await page.goto('/login');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5174/login
  18 |   await page.getByLabel(/^email$/i).fill(credentials.email);
  19 |   await page.getByLabel(/^password$/i).fill(credentials.password);
  20 |   await page.locator('form').getByRole('button', { name: 'Log in' }).click();
  21 |   await page.waitForURL(/\/admin/, { timeout: 20_000 });
  22 |   return { page, context };
  23 | }
  24 | 
  25 | export const test = base.extend<{
  26 |   adminPage: Page;
  27 |   role: StaffRoleSlug;
  28 |   staffUser: TestStaffUser;
  29 |   staffPage: Page;
  30 | }>({
  31 |   adminPage: async ({ browser }, use) => {
  32 |     await insertTestAdmin();
  33 |     const { page, context } = await loginViaUi(browser, {
  34 |       email: ADMIN_EMAIL,
  35 |       password: ADMIN_PASSWORD,
  36 |     });
  37 |     try {
  38 |       await use(page);
  39 |     } finally {
  40 |       await context.close();
  41 |     }
  42 |   },
  43 | 
  44 |   role: ['driver', { option: true }],
  45 | 
  46 |   staffUser: async ({ role }, use) => {
  47 |     await insertTestAdmin();
  48 |     const user = await insertTestStaff({ roleSlug: role });
  49 |     try {
  50 |       await use(user);
  51 |     } finally {
  52 |       await cleanupTestStaff(user.email).catch(() => undefined);
  53 |     }
  54 |   },
  55 | 
  56 |   staffPage: async ({ browser, staffUser }, use) => {
  57 |     const { page, context } = await loginViaUi(browser, {
  58 |       email: staffUser.email,
  59 |       password: staffUser.password,
  60 |     });
  61 |     try {
  62 |       await use(page);
  63 |     } finally {
  64 |       await context.close();
  65 |     }
  66 |   },
  67 | });
  68 | 
  69 | export { expect } from '@playwright/test';
  70 | export { cookiesFromSession, loginAsAdmin, loginApi } from '../helpers/csrf';
  71 | export type { StaffRoleSlug, TestStaffUser };
  72 | export type { ApiSession } from '../helpers/csrf';
  73 | 
```