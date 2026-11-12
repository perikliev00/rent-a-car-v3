/**
 * Captures after screenshots for mobile audit docs at 293x643.
 * Run: node e2e/scripts/capture-mobile-audit.mjs (with servers up)
 */
import { chromium } from '@playwright/test';
// Import fs from 'fs'.
import fs from 'fs';
// Import path from 'path'.
import path from 'path';
// Import named exports from 'url'.
import { fileURLToPath } from 'url';

// Create the dirname constant.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Create the out dir constant.
const outDir = path.resolve(__dirname, '..', '..', 'docs', 'mobile-audit', 'after');
// Call fs.mkdirSync to perform this step.
fs.mkdirSync(outDir, { recursive: true });

// Create the admin constant.
const ADMIN = process.env.ADMIN_BASE_URL || 'http://localhost:5174';
// Create the email constant.
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@luxride.local';
// Create the password constant.
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123!';

// Define the async function overflow.
async function overflow(page) {
  // Return the resulting value to the caller.
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

// Define the async function main.
async function main() {
  // Create the browser constant.
  const browser = await chromium.launch();
  // Create the context constant.
  const context = await browser.newContext({
    // Provide the viewport field value.
    viewport: { width: 293, height: 643 },
    // Provide the is mobile field value.
    isMobile: true,
    // Provide the has touch field value.
    hasTouch: true,
  });
  // Create the page constant.
  const page = await context.newPage();
  // Wait until the asynchronous operation resolves.
  await page.goto(`${ADMIN}/login`);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel(/^email$/i).fill(EMAIL);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  // Wait until the asynchronous operation resolves.
  await page.locator('form').getByRole('button', { name: 'Log in' }).click();
  // Wait until the asynchronous operation resolves.
  await page.waitForURL(/\/admin/, { timeout: 30_000 });

  // Create the shots constant.
  const shots = [
    // Contribute this line to the enclosing declaration or statement.
    ['orders', '/admin/orders'],
    // Contribute this line to the enclosing declaration or statement.
    ['analytics', '/admin/analytics'],
    // Contribute this line to the enclosing declaration or statement.
    ['notifications', '/admin/notifications'],
    // Contribute this line to the enclosing declaration or statement.
    ['payments', '/admin/payments'],
    // Continue the surrounding logic with this statement.
    ['calendar', '/admin/calendar?view=week&date=2026-09-15'],
  ];

  // Create the report constant.
  const report = [];
  // Iterate using the loop initializer, condition, and step.
  for (const [name, pathName] of shots) {
    // Wait until the asynchronous operation resolves.
    await page.goto(`${ADMIN}${pathName}`);
    // Wait until the asynchronous operation resolves.
    await page.waitForTimeout(800);
    // Create the o constant.
    const o = await overflow(page);
    // Wait until the asynchronous operation resolves.
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
    // Call report.push to perform this step.
    report.push({ name, overflow: o });
  }

  // Wait until the asynchronous operation resolves.
  await page.goto(`${ADMIN}/admin/orders`);
  // Wait until the asynchronous operation resolves.
  await page.getByTestId('admin-mobile-menu').click();
  // Wait until the asynchronous operation resolves.
  await page.waitForTimeout(400);
  // Wait until the asynchronous operation resolves.
  await page.screenshot({ path: path.join(outDir, 'mobile-nav.png'), fullPage: false });
  // Call report.push to perform this step.
  report.push({ name: 'mobile-nav', overflow: await overflow(page) });
  // Wait until the asynchronous operation resolves.
  await page.getByRole('dialog', { name: 'Admin menu' }).getByRole('button', { name: 'Close' }).click();

  // Wait until the asynchronous operation resolves.
  await page.goto(`${ADMIN}/admin/calendar?view=day&date=2026-09-15`);
  // Wait until the asynchronous operation resolves.
  await page.waitForTimeout(600);
  // Create the date btn constant.
  const dateBtn = page.locator('button[aria-haspopup="dialog"]').first();
  // Wait until the asynchronous operation resolves.
  await dateBtn.click();
  // Wait until the asynchronous operation resolves.
  await page.waitForTimeout(300);
  // Wait until the asynchronous operation resolves.
  await page.screenshot({ path: path.join(outDir, 'date-picker.png'), fullPage: false });
  // Call report.push to perform this step.
  report.push({ name: 'date-picker', overflow: await overflow(page) });

  // Call fs.writeFileSync to perform this step.
  fs.writeFileSync(path.join(outDir, 'overflow-report.json'), JSON.stringify(report, null, 2));
  // Emit a diagnostic log message.
  console.log(JSON.stringify(report, null, 2));
  // Wait until the asynchronous operation resolves.
  await browser.close();
}

// Call main to perform this step.
main().catch((err) => {
  // Emit a diagnostic log message.
  console.error(err);
  // Call process.exit to perform this step.
  process.exit(1);
});
