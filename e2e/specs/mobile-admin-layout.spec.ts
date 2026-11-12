// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/test-env'.
import { adminUrl } from '../helpers/test-env';
// Import named exports from '../helpers/overflow'.
import { expectNoDocumentOverflow } from '../helpers/overflow';

// Call test.describe to perform this step.
test.describe('mobile-admin-layout', () => {
  // Call test.use to perform this step.
  test.use({
    // Provide the viewport field value.
    viewport: { width: 293, height: 643 },
    // Provide the is mobile field value.
    isMobile: true,
    // Provide the has touch field value.
    hasTouch: true,
  });

  // Call test.setTimeout to perform this step.
  test.setTimeout(120_000);

  // Define a single test case and its expectations.
  test('mobile menu exposes destinations and logout without document overflow', async ({
    // Contribute this line to the enclosing declaration or statement.
    adminPage,
  // Continue the surrounding logic with this statement.
  }) => {
    // Wait until the asynchronous operation resolves.
    await adminPage.goto(adminUrl('/admin/orders'));
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Orders' })).toBeVisible({
      // Provide the timeout field value.
      timeout: 20_000,
    });
    // Wait until the asynchronous operation resolves.
    await expectNoDocumentOverflow(adminPage);

    // Wait until the asynchronous operation resolves.
    await adminPage.getByTestId('admin-mobile-menu').click();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('dialog', { name: 'Admin menu' })).toBeVisible();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('link', { name: 'Analytics' })).toBeVisible();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByTestId('admin-mobile-logout')).toBeVisible();
    // Wait until the asynchronous operation resolves.
    await expectNoDocumentOverflow(adminPage);

    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('link', { name: 'Analytics' }).click();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Analytics' })).toBeVisible({
      // Provide the timeout field value.
      timeout: 20_000,
    });
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('dialog', { name: 'Admin menu' })).toHaveCount(0);
    // Wait until the asynchronous operation resolves.
    await expectNoDocumentOverflow(adminPage);
  });

  // Define a single test case and its expectations.
  test('orders payments analytics notifications calendar fit viewport', async ({ adminPage }) => {
    // Create the routes constant.
    const routes = [
      // Contribute this line to the enclosing declaration or statement.
      { path: '/admin/orders', heading: 'Orders' },
      // Contribute this line to the enclosing declaration or statement.
      { path: '/admin/payments', heading: 'Payments' },
      // Contribute this line to the enclosing declaration or statement.
      { path: '/admin/analytics', heading: 'Analytics' },
      // Contribute this line to the enclosing declaration or statement.
      { path: '/admin/notifications', heading: 'Notifications' },
      // Continue the surrounding logic with this statement.
      { path: '/admin/calendar?view=week&date=2026-09-15', heading: 'Fleet calendar' },
    // Apply the TypeScript type assertion for this value.
    ] as const;

    // Iterate using the loop initializer, condition, and step.
    for (const route of routes) {
      // Wait until the asynchronous operation resolves.
      await adminPage.goto(adminUrl(route.path));
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: route.heading })).toBeVisible({
        // Provide the timeout field value.
        timeout: 20_000,
      });
      // Wait until the asynchronous operation resolves.
      await expectNoDocumentOverflow(adminPage);
      // Create the scroll x constant.
      const scrollX = await adminPage.evaluate(() => window.scrollX);
      // Assert that the value matches the intended expectation.
      expect(scrollX).toBe(0);
    }

    // Wait until the asynchronous operation resolves.
    await adminPage.goto(adminUrl('/admin/calendar?view=day&date=2026-09-15'));
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByTestId('calendar-day-agenda')).toBeVisible({ timeout: 20_000 });
    // Wait until the asynchronous operation resolves.
    await expectNoDocumentOverflow(adminPage);

    // Wait until the asynchronous operation resolves.
    await adminPage.getByTestId('calendar-agenda-toggle').click();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByTestId('fleet-timeline-scroll')).toBeVisible({ timeout: 10_000 });
    // Wait until the asynchronous operation resolves.
    await expectNoDocumentOverflow(adminPage);
  });

  // Define a single test case and its expectations.
  test('date picker near bottom edge stays in viewport', async ({ adminPage }) => {
    // Wait until the asynchronous operation resolves.
    await adminPage.goto(adminUrl('/admin/calendar?view=day&date=2026-09-15'));
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Fleet calendar' })).toBeVisible({
      // Provide the timeout field value.
      timeout: 20_000,
    });

    // Create the date trigger constant.
    const dateTrigger = adminPage.locator('button[aria-haspopup="dialog"]').filter({
      // Provide the has text field value.
      hasText: /Sep|Select date|\d{4}/i,
    // Continue the surrounding logic with this statement.
    }).first();
    // Wait until the asynchronous operation resolves.
    await dateTrigger.scrollIntoViewIfNeeded();
    // Wait until the asynchronous operation resolves.
    await adminPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // Wait until the asynchronous operation resolves.
    await dateTrigger.click();

    // Create the picker constant.
    const picker = adminPage.locator('[role="dialog"][aria-label*="picker"], [role="dialog"][aria-label*="Date"]').first();
    // Wait until the asynchronous operation resolves.
    await expect(picker).toBeVisible({ timeout: 5_000 });
    // Create the box constant.
    const box = await picker.boundingBox();
    // Assert that the value matches the intended expectation.
    expect(box).toBeTruthy();
    // Evaluate the condition and enter the branch when it is true.
    if (box) {
      // Assert that the value matches the intended expectation.
      expect(box.x).toBeGreaterThanOrEqual(0);
      // Assert that the value matches the intended expectation.
      expect(box.y).toBeGreaterThanOrEqual(0);
      // Assert that the value matches the intended expectation.
      expect(box.x + box.width).toBeLessThanOrEqual(293 + 2);
      // Assert that the value matches the intended expectation.
      expect(box.y + box.height).toBeLessThanOrEqual(643 + 2);
    }
    // Wait until the asynchronous operation resolves.
    await expectNoDocumentOverflow(adminPage);
  });
});
