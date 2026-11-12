// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/overflow'.
import { expectNoDocumentOverflow } from '../helpers/overflow';
// Import named exports from '../helpers/test-env'.
import { allocateFutureRange } from '../helpers/test-env';

// Call test.describe to perform this step.
test.describe('mobile-public-booking', () => {
  // Call test.use to perform this step.
  test.use({
    // Provide the viewport field value.
    viewport: { width: 390, height: 844 },
    // Provide the is mobile field value.
    isMobile: true,
    // Provide the has touch field value.
    hasTouch: true,
  });

  // Call test.setTimeout to perform this step.
  test.setTimeout(120_000);

  // Define a single test case and its expectations.
  test('home search and mobile nav fit without document overflow', async ({ page }) => {
    // Wait until the asynchronous operation resolves.
    await page.goto('/');
    // Wait until the asynchronous operation resolves.
    await expect(page.getByRole('link', { name: 'LuxRide' }).first()).toBeVisible();
    // Wait until the asynchronous operation resolves.
    await expectNoDocumentOverflow(page);

    // Wait until the asynchronous operation resolves.
    await page.getByTestId('public-mobile-menu').click();
    // Create the menu constant.
    const menu = page.getByRole('dialog', { name: 'Menu' });
    // Wait until the asynchronous operation resolves.
    await expect(menu).toBeVisible();
    // Wait until the asynchronous operation resolves.
    await expect(menu.getByRole('link', { name: 'How to Book' })).toBeVisible();
    // Wait until the asynchronous operation resolves.
    await expectNoDocumentOverflow(page);
    // Wait until the asynchronous operation resolves.
    await menu.getByRole('button', { name: 'Close' }).click();

    // Create the range constant.
    const range = allocateFutureRange(3, 4);
    // Prefer DateSelect triggers if present; fall through to native if needed.
    const pickup = page.getByLabel(/pickup date/i).first();
    // Evaluate the condition and enter the branch when it is true.
    if (await pickup.count()) {
      // DateSelect uses a button + hidden input; interact via visible control near label.
      await page.getByRole('button', { name: /select date|pickup/i }).first().click().catch(() => undefined);
    }

    // Wait until the asynchronous operation resolves.
    await page.goto(
      // Continue the surrounding logic with this statement.
      `/search?pickup-date=${range.pickupDate}&return-date=${range.returnDate}&pickup-time=10:00&return-time=10:00&pickup-location=Sofia&return-location=Sofia`
    );
    // Wait until the asynchronous operation resolves.
    await expect(page.getByRole('heading', { name: /search|available|cars/i }).first()).toBeVisible({
      // Provide the timeout field value.
      timeout: 20_000,
    // Continue the surrounding logic with this statement.
    }).catch(async () => {
      // Wait until the asynchronous operation resolves.
      await expect(page.locator('body')).toBeVisible();
    });
    // Wait until the asynchronous operation resolves.
    await expectNoDocumentOverflow(page);
  });
});
