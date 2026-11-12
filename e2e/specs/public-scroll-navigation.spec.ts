// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';

// Define the async function expectFooterNavigationResetsScroll.
async function expectFooterNavigationResetsScroll(page: import('@playwright/test').Page) {
  // Wait until the asynchronous operation resolves.
  await page.goto('/');
  // Wait until the asynchronous operation resolves.
  await expect(page.getByRole('link', { name: 'LuxRide' }).first()).toBeVisible();

  // Create the footer about constant.
  const footerAbout = page.locator('footer').getByRole('link', { name: 'About Us' });
  // Wait until the asynchronous operation resolves.
  await footerAbout.scrollIntoViewIfNeeded();
  // Wait until the asynchronous operation resolves.
  await expect(footerAbout).toBeVisible();

  // Create the scrolled y constant.
  const scrolledY = await page.evaluate(() => window.scrollY);
  // Assert that the value matches the intended expectation.
  expect(scrolledY).toBeGreaterThan(100);

  // Wait until the asynchronous operation resolves.
  await footerAbout.click();
  // Wait until the asynchronous operation resolves.
  await expect(page).toHaveURL(/\/about$/);
  // Wait until the asynchronous operation resolves.
  await expect(page.getByRole('heading', { name: /about/i }).first()).toBeVisible({
    // Provide the timeout field value.
    timeout: 15_000,
  });

  // Wait until the asynchronous operation resolves.
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);
}

// Call test.describe to perform this step.
test.describe('public scroll navigation — desktop', () => {
  // Call test.use to perform this step.
  test.use({ viewport: { width: 1280, height: 720 } });

  // Define a single test case and its expectations.
  test('footer link opens the next page at the top', async ({ page }) => {
    // Wait until the asynchronous operation resolves.
    await expectFooterNavigationResetsScroll(page);
  });

  // Define a single test case and its expectations.
  test('back navigation is not forced to the top', async ({ page }) => {
    // Wait until the asynchronous operation resolves.
    await page.goto('/');
    // Create the footer about constant.
    const footerAbout = page.locator('footer').getByRole('link', { name: 'About Us' });
    // Wait until the asynchronous operation resolves.
    await footerAbout.scrollIntoViewIfNeeded();
    // Create the home scroll y constant.
    const homeScrollY = await page.evaluate(() => window.scrollY);
    // Assert that the value matches the intended expectation.
    expect(homeScrollY).toBeGreaterThan(100);

    // Wait until the asynchronous operation resolves.
    await footerAbout.click();
    // Wait until the asynchronous operation resolves.
    await expect(page).toHaveURL(/\/about$/);
    // Wait until the asynchronous operation resolves.
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);

    // Wait until the asynchronous operation resolves.
    await page.goBack();
    // Wait until the asynchronous operation resolves.
    await expect(page).toHaveURL(/\/$/);
    // Browser may restore prior scroll; we must not force top on POP.
    await expect
      // Call .poll to perform this step.
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      // Call .toBeGreaterThan to perform this step.
      .toBeGreaterThan(50);
  });
});

// Call test.describe to perform this step.
test.describe('public scroll navigation — mobile viewport', () => {
  // Call test.use to perform this step.
  test.use({
    // Provide the viewport field value.
    viewport: { width: 390, height: 844 },
    // Provide the is mobile field value.
    isMobile: true,
    // Provide the has touch field value.
    hasTouch: true,
  });

  // Define a single test case and its expectations.
  test('footer link opens the next page at the top', async ({ page }) => {
    // Wait until the asynchronous operation resolves.
    await expectFooterNavigationResetsScroll(page);
  });
});
