# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\specs\account-portal.spec.ts >> account-portal >> Customer account portal auth >> unauthenticated visitor is redirected from account dashboard
- Location: e2e\specs\account-portal.spec.ts:21:9

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/account", waiting until "load"

```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import fs from 'fs';
  3   | import path from 'path';
  4   | import { applySessionCookies, signupCustomer, signupViaUi } from '../helpers/account';
  5   | import {
  6   |   assertReservationStatus,
  7   |   cleanupE2eCarsByName,
  8   |   cleanupReservationsForCar,
  9   |   cleanupTestCar,
  10  |   getReservationById,
  11  |   getReservationUserId,
  12  |   issueEmailVerificationToken,
  13  | } from '../helpers/db';
  14  | import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
  15  | import { E2E_GUEST, adminUrl, allocateFutureRange, uniqueEmail } from '../helpers/test-env';
  16  | 
  17  | test.describe.configure({ mode: 'serial' });
  18  | 
  19  | test.describe("account-portal", () => {
  20  |   test.describe('Customer account portal auth', () => {
  21  |     test('unauthenticated visitor is redirected from account dashboard', async ({ page }) => {
> 22  |       await page.goto('/account');
      |                  ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  23  |       await expect(page).toHaveURL(/\/login/);
  24  |     });
  25  | 
  26  |     test('customer can open account dashboard after signup', async ({ page }) => {
  27  |       const email = `portal-e2e-${Date.now()}@example.com`;
  28  |       const password = 'Customer123!';
  29  | 
  30  |       await page.goto('/signup');
  31  |       await page.getByLabel('Email').fill(email);
  32  |       await page.getByLabel('Password', { exact: true }).fill(password);
  33  |       await page.getByLabel('Confirm password').fill(password);
  34  |       await page.getByRole('main').getByRole('button', { name: /sign up|create account/i }).click();
  35  | 
  36  |       await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });
  37  | 
  38  |       await page.goto('/account');
  39  |       await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
  40  |         timeout: 15_000,
  41  |       });
  42  |     });
  43  | 
  44  |     test('customer is denied admin pricing page', async ({ page }) => {
  45  |       const email = `pricing-deny-${Date.now()}@example.com`;
  46  |       const password = 'Customer123!';
  47  | 
  48  |       await page.goto('/signup');
  49  |       await page.getByLabel('Email').fill(email);
  50  |       await page.getByLabel('Password', { exact: true }).fill(password);
  51  |       await page.getByLabel('Confirm password').fill(password);
  52  |       await page.getByRole('main').getByRole('button', { name: /sign up|create account/i }).click();
  53  | 
  54  |       await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });
  55  | 
  56  |       await page.goto(adminUrl('/admin/pricing'));
  57  |       await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({
  58  |         timeout: 15_000,
  59  |       });
  60  |     });
  61  |   });
  62  | });
  63  | 
  64  | test.describe("account-documents", () => {
  65  |   const CAR_NAME = `E2E Account Docs ${Date.now()}`;
  66  |   const PASSWORD = 'Customer123!';
  67  |   const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');
  68  |   const DOC_A = path.join(FIXTURE_DIR, 'doc-a.pdf');
  69  |   const DOC_B = path.join(FIXTURE_DIR, 'doc-b.pdf');
  70  | 
  71  |   function ensureTinyPdf(filePath: string, label: string) {
  72  |     if (fs.existsSync(filePath)) return;
  73  |     fs.mkdirSync(path.dirname(filePath), { recursive: true });
  74  |     // Minimal valid-enough PDF bytes for multer accept.
  75  |     const content = `%PDF-1.1
  76  |   1 0 obj<<>>endobj
  77  |   trailer<<>>
  78  |   %%EOF
  79  |   % ${label}
  80  |   `;
  81  |     fs.writeFileSync(filePath, content);
  82  |   }
  83  | 
  84  |   test.describe('CUST-004 Account documents upload replace download delete', () => {
  85  |     test.setTimeout(120_000);
  86  | 
  87  |     let carId: number;
  88  | 
  89  |     test.beforeAll(async () => {
  90  |       ensureTinyPdf(DOC_A, 'doc-a');
  91  |       ensureTinyPdf(DOC_B, 'doc-b');
  92  |       await cleanupE2eCarsByName(CAR_NAME);
  93  |       carId = await seedE2eFixtures(CAR_NAME);
  94  |     });
  95  | 
  96  |     test.afterAll(async () => {
  97  |       await cleanupTestCar(carId);
  98  |     });
  99  | 
  100 |     test('customer can upload, replace, download, and delete a document', async ({ page, request }) => {
  101 |       const email = uniqueEmail('docs');
  102 |       const customer = await signupCustomer(request, { email, password: PASSWORD });
  103 |       await applySessionCookies(page, customer.session);
  104 | 
  105 |       await page.goto('/account/documents');
  106 |       await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible({
  107 |         timeout: 15_000,
  108 |       });
  109 | 
  110 |       await page.getByLabel('Document type').selectOption('driver_license');
  111 |       await page.locator('input[type="file"]').setInputFiles(DOC_A);
  112 |       await page.getByRole('button', { name: 'Upload' }).click();
  113 |       // Toast stack can keep prior success toasts visible — use .last() for strict mode.
  114 |       await expect(page.getByText('Document uploaded').last()).toBeVisible({ timeout: 15_000 });
  115 |       await expect(page.getByText(/Driver license/i).first()).toBeVisible();
  116 | 
  117 |       await page.locator('input[type="file"]').setInputFiles(DOC_B);
  118 |       await page.getByRole('button', { name: 'Upload' }).click();
  119 |       await expect(page.getByText('Document uploaded').last()).toBeVisible({ timeout: 15_000 });
  120 | 
  121 |       const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
  122 |       await page.getByRole('button', { name: 'Download' }).first().click();
```