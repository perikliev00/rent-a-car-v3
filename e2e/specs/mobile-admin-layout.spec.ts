import { expect, test } from '../fixtures/base';
import { adminUrl } from '../helpers/test-env';
import { expectNoDocumentOverflow } from '../helpers/overflow';

test.describe('mobile-admin-layout', () => {
  test.use({
    viewport: { width: 293, height: 643 },
    isMobile: true,
    hasTouch: true,
  });

  test.setTimeout(120_000);

  test('mobile menu exposes destinations and logout without document overflow', async ({
    adminPage,
  }) => {
    await adminPage.goto(adminUrl('/admin/orders'));
    await expect(adminPage.getByRole('heading', { name: 'Orders' })).toBeVisible({
      timeout: 20_000,
    });
    await expectNoDocumentOverflow(adminPage);

    await adminPage.getByTestId('admin-mobile-menu').click();
    await expect(adminPage.getByRole('dialog', { name: 'Admin menu' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Analytics' })).toBeVisible();
    await expect(adminPage.getByTestId('admin-mobile-logout')).toBeVisible();
    await expectNoDocumentOverflow(adminPage);

    await adminPage.getByRole('link', { name: 'Analytics' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Analytics' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(adminPage.getByRole('dialog', { name: 'Admin menu' })).toHaveCount(0);
    await expectNoDocumentOverflow(adminPage);
  });

  test('orders payments analytics notifications calendar fit viewport', async ({ adminPage }) => {
    const routes = [
      { path: '/admin/orders', heading: 'Orders' },
      { path: '/admin/payments', heading: 'Payments' },
      { path: '/admin/analytics', heading: 'Analytics' },
      { path: '/admin/notifications', heading: 'Notifications' },
      { path: '/admin/calendar?view=week&date=2026-09-15', heading: 'Fleet calendar' },
    ] as const;

    for (const route of routes) {
      await adminPage.goto(adminUrl(route.path));
      await expect(adminPage.getByRole('heading', { name: route.heading })).toBeVisible({
        timeout: 20_000,
      });
      await expectNoDocumentOverflow(adminPage);
      const scrollX = await adminPage.evaluate(() => window.scrollX);
      expect(scrollX).toBe(0);
    }

    await adminPage.goto(adminUrl('/admin/calendar?view=day&date=2026-09-15'));
    await expect(adminPage.getByTestId('calendar-day-agenda')).toBeVisible({ timeout: 20_000 });
    await expectNoDocumentOverflow(adminPage);

    await adminPage.getByTestId('calendar-agenda-toggle').click();
    await expect(adminPage.getByTestId('fleet-timeline-scroll')).toBeVisible({ timeout: 10_000 });
    await expectNoDocumentOverflow(adminPage);
  });

  test('date picker near bottom edge stays in viewport', async ({ adminPage }) => {
    await adminPage.goto(adminUrl('/admin/calendar?view=day&date=2026-09-15'));
    await expect(adminPage.getByRole('heading', { name: 'Fleet calendar' })).toBeVisible({
      timeout: 20_000,
    });

    const dateTrigger = adminPage.locator('button[aria-haspopup="dialog"]').filter({
      hasText: /Sep|Select date|\d{4}/i,
    }).first();
    await dateTrigger.scrollIntoViewIfNeeded();
    await adminPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await dateTrigger.click();

    const picker = adminPage.locator('[role="dialog"][aria-label*="picker"], [role="dialog"][aria-label*="Date"]').first();
    await expect(picker).toBeVisible({ timeout: 5_000 });
    const box = await picker.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(293 + 2);
      expect(box.y + box.height).toBeLessThanOrEqual(643 + 2);
    }
    await expectNoDocumentOverflow(adminPage);
  });
});
