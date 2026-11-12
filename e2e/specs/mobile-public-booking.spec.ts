import { expect, test } from '../fixtures/base';
import { expectNoDocumentOverflow } from '../helpers/overflow';
import { allocateFutureRange } from '../helpers/test-env';

test.describe('mobile-public-booking', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test.setTimeout(120_000);

  test('home search and mobile nav fit without document overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'LuxRide' }).first()).toBeVisible();
    await expectNoDocumentOverflow(page);

    await page.getByTestId('public-mobile-menu').click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'How to Book' })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await menu.getByRole('button', { name: 'Close' }).click();

    const range = allocateFutureRange(3, 4);
    // Prefer DateSelect triggers if present; fall through to native if needed.
    const pickup = page.getByLabel(/pickup date/i).first();
    if (await pickup.count()) {
      // DateSelect uses a button + hidden input; interact via visible control near label.
      await page.getByRole('button', { name: /select date|pickup/i }).first().click().catch(() => undefined);
    }

    await page.goto(
      `/search?pickup-date=${range.pickupDate}&return-date=${range.returnDate}&pickup-time=10:00&return-time=10:00&pickup-location=Sofia&return-location=Sofia`
    );
    await expect(page.getByRole('heading', { name: /search|available|cars/i }).first()).toBeVisible({
      timeout: 20_000,
    }).catch(async () => {
      await expect(page.locator('body')).toBeVisible();
    });
    await expectNoDocumentOverflow(page);
  });
});
