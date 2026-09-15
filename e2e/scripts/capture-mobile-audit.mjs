/**
 * Captures after screenshots for mobile audit docs at 293x643.
 * Run: node e2e/scripts/capture-mobile-audit.mjs (with servers up)
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', '..', 'docs', 'mobile-audit', 'after');
fs.mkdirSync(outDir, { recursive: true });

const ADMIN = process.env.ADMIN_BASE_URL || 'http://localhost:5174';
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@luxride.local';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123!';

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 293, height: 643 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`${ADMIN}/login`);
  await page.getByLabel(/^email$/i).fill(EMAIL);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.locator('form').getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(/\/admin/, { timeout: 30_000 });

  const shots = [
    ['orders', '/admin/orders'],
    ['analytics', '/admin/analytics'],
    ['notifications', '/admin/notifications'],
    ['payments', '/admin/payments'],
    ['calendar', '/admin/calendar?view=week&date=2026-09-15'],
  ];

  const report = [];
  for (const [name, pathName] of shots) {
    await page.goto(`${ADMIN}${pathName}`);
    await page.waitForTimeout(800);
    const o = await overflow(page);
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
    report.push({ name, overflow: o });
  }

  await page.goto(`${ADMIN}/admin/orders`);
  await page.getByTestId('admin-mobile-menu').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'mobile-nav.png'), fullPage: false });
  report.push({ name: 'mobile-nav', overflow: await overflow(page) });
  await page.getByRole('dialog', { name: 'Admin menu' }).getByRole('button', { name: 'Close' }).click();

  await page.goto(`${ADMIN}/admin/calendar?view=day&date=2026-09-15`);
  await page.waitForTimeout(600);
  const dateBtn = page.locator('button[aria-haspopup="dialog"]').first();
  await dateBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'date-picker.png'), fullPage: false });
  report.push({ name: 'date-picker', overflow: await overflow(page) });

  fs.writeFileSync(path.join(outDir, 'overflow-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
