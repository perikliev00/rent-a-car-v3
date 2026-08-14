import path from 'path';
import fs from 'fs';
import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import { cleanupTestCar, cleanupE2eCarsByName } from '../helpers/db';
import { uniqueEmail } from '../helpers/test-env';
import { signupCustomer, applySessionCookies } from '../helpers/account';

const CAR_NAME = `E2E Account Docs ${Date.now()}`;
const PASSWORD = 'Customer123!';
const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');
const DOC_A = path.join(FIXTURE_DIR, 'doc-a.pdf');
const DOC_B = path.join(FIXTURE_DIR, 'doc-b.pdf');

function ensureTinyPdf(filePath: string, label: string) {
  if (fs.existsSync(filePath)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // Minimal valid-enough PDF bytes for multer accept.
  const content = `%PDF-1.1
1 0 obj<<>>endobj
trailer<<>>
%%EOF
% ${label}
`;
  fs.writeFileSync(filePath, content);
}

test.describe.configure({ mode: 'serial' });

test.describe('CUST-004 Account documents upload replace download delete', () => {
  test.setTimeout(120_000);

  let carId: number;

  test.beforeAll(async () => {
    ensureTinyPdf(DOC_A, 'doc-a');
    ensureTinyPdf(DOC_B, 'doc-b');
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupTestCar(carId);
  });

  test('customer can upload, replace, download, and delete a document', async ({ page, request }) => {
    const email = uniqueEmail('docs');
    const customer = await signupCustomer(request, { email, password: PASSWORD });
    await applySessionCookies(page, customer.session);

    await page.goto('/account/documents');
    await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel('Document type').selectOption('driver_license');
    await page.locator('input[type="file"]').setInputFiles(DOC_A);
    await page.getByRole('button', { name: 'Upload' }).click();
    await expect(page.getByText('Document uploaded')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Driver license/i).first()).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles(DOC_B);
    await page.getByRole('button', { name: 'Upload' }).click();
    await expect(page.getByText('Document uploaded')).toBeVisible({ timeout: 15_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Download' }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBeTruthy();

    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByText('Document deleted')).toBeVisible({ timeout: 15_000 });
  });
});
