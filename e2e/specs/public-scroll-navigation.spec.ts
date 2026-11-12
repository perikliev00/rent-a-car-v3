import { expect, test } from '../fixtures/base';

async function expectFooterNavigationResetsScroll(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'LuxRide' }).first()).toBeVisible();

  const footerAbout = page.locator('footer').getByRole('link', { name: 'About Us' });
  await footerAbout.scrollIntoViewIfNeeded();
  await expect(footerAbout).toBeVisible();

  const scrolledY = await page.evaluate(() => window.scrollY);
  expect(scrolledY).toBeGreaterThan(100);

  await footerAbout.click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { name: /about/i }).first()).toBeVisible({
    timeout: 15_000,
  });

  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);
}

test.describe('public scroll navigation — desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('footer link opens the next page at the top', async ({ page }) => {
    await expectFooterNavigationResetsScroll(page);
  });

  test('back navigation is not forced to the top', async ({ page }) => {
    await page.goto('/');
    const footerAbout = page.locator('footer').getByRole('link', { name: 'About Us' });
    await footerAbout.scrollIntoViewIfNeeded();
    const homeScrollY = await page.evaluate(() => window.scrollY);
    expect(homeScrollY).toBeGreaterThan(100);

    await footerAbout.click();
    await expect(page).toHaveURL(/\/about$/);
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    // Browser may restore prior scroll; we must not force top on POP.
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeGreaterThan(50);
  });
});

test.describe('public scroll navigation — mobile viewport', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('footer link opens the next page at the top', async ({ page }) => {
    await expectFooterNavigationResetsScroll(page);
  });
});
