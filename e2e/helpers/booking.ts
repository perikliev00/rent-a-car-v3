// Contribute this line to the enclosing declaration or statement.
import type { Page, Locator } from '@playwright/test';
// Import named exports from '@playwright/test'.
import { expect } from '@playwright/test';
// Contribute this line to the enclosing declaration or statement.
import type { AllocatedFutureRange } from './dates';
// Import named exports from './test-env'.
import { E2E_GUEST } from './test-env';
// Import named exports from './db'.
import { cleanupReservationsForCar } from './db';

// Export the buildSearchQuery function.
export function buildSearchQuery(
  // Provide the range field value.
  range: AllocatedFutureRange,
  // Contribute this line to the enclosing declaration or statement.
  extras?: { pickupLocation?: string; returnLocation?: string; page?: number }
// Continue the surrounding logic with this statement.
): string {
  // Create the params constant.
  const params = new URLSearchParams({
    // Supply the literal value used by the enclosing expression.
    'pickup-date': range.pickupDate,
    // Supply the literal value used by the enclosing expression.
    'return-date': range.returnDate,
    // Supply the literal value used by the enclosing expression.
    'pickup-time': range.pickupTime,
    // Supply the literal value used by the enclosing expression.
    'return-time': range.returnTime,
    // Supply the literal value used by the enclosing expression.
    'pickup-location': extras?.pickupLocation ?? 'office',
    // Supply the literal value used by the enclosing expression.
    'return-location': extras?.returnLocation ?? 'office',
  });
  // Evaluate the condition and enter the branch when it is true.
  if (extras?.page) params.set('page', String(extras.page));
  // Return the resulting value to the caller.
  return params.toString();
}

// Export the buildOrderUrl function.
export function buildOrderUrl(
  // Provide the car id field value.
  carId: number,
  // Provide the range field value.
  range: AllocatedFutureRange,
  // Contribute this line to the enclosing declaration or statement.
  extras?: {
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation?: string;
    // Contribute this line to the enclosing declaration or statement.
    returnLocation?: string;
    // Contribute this line to the enclosing declaration or statement.
    hotelDelivery?: boolean;
    // Contribute this line to the enclosing declaration or statement.
    extrasCodes?: string[];
  }
// Continue the surrounding logic with this statement.
): string {
  // Create the params constant.
  const params = new URLSearchParams({
    // Supply the literal value used by the enclosing expression.
    'pickup-date': range.pickupDate,
    // Supply the literal value used by the enclosing expression.
    'return-date': range.returnDate,
    // Supply the literal value used by the enclosing expression.
    'pickup-time': range.pickupTime,
    // Supply the literal value used by the enclosing expression.
    'return-time': range.returnTime,
    // Supply the literal value used by the enclosing expression.
    'pickup-location': extras?.pickupLocation ?? 'office',
    // Supply the literal value used by the enclosing expression.
    'return-location': extras?.returnLocation ?? 'office',
  });
  // Evaluate the condition and enter the branch when it is true.
  if (extras?.hotelDelivery) params.set('hotelDelivery', '1');
  // Evaluate the condition and enter the branch when it is true.
  if (extras?.extrasCodes?.length) params.set('extras', extras.extrasCodes.join(','));
  // Return the resulting value to the caller.
  return `/order/${carId}?${params.toString()}`;
}

// Export the async fillHomeSearch function.
export async function fillHomeSearch(page: Page, range: AllocatedFutureRange): Promise<void> {
  // Date/time controls are custom pickers (buttons), not native inputs — drive search via URL.
  await page.goto(`/search?${buildSearchQuery(range)}`);
  // Wait until the asynchronous operation resolves.
  await page.waitForURL(/\/search/);
}

// Declare the OrderPageState TypeScript type alias.
type OrderPageState = 'review' | 'rehold' | 'release' | 'retry' | 'rate_limited';

// Define the async function clickWhenEnabled.
async function clickWhenEnabled(locator: Locator, timeout = 15_000): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await expect(locator).toBeEnabled({ timeout });
  // Wait until the asynchronous operation resolves.
  await locator.click();
}

// Define the async function waitForOrderPageState.
async function waitForOrderPageState(page: Page, timeout = 20_000): Promise<OrderPageState> {
  // Do not use locator.or() across conflict copy + Retry — they co-exist and trip strict mode.
  let state: OrderPageState | null = null;
  // Wait until the asynchronous operation resolves.
  await expect
    // Call .poll to perform this step.
    .poll(
      // Call async to perform this step.
      async () => {
        // Evaluate the condition and enter the branch when it is true.
        if (await page.getByRole('heading', { name: 'Review your booking' }).isVisible().catch(() => false)) {
          // Update state with the right-hand side value.
          state = 'review';
          // Return the resulting value to the caller.
          return 'review';
        }
        // Evaluate the condition and enter the branch when it is true.
        if (await page.getByText(/Too many requests/i).isVisible().catch(() => false)) {
          // Update state with the right-hand side value.
          state = 'rate_limited';
          // Return the resulting value to the caller.
          return 'rate_limited';
        }
        // Evaluate the condition and enter the branch when it is true.
        if (
          // Wait until the asynchronous operation resolves.
          await page
            // Call .getByRole to perform this step.
            .getByRole('button', { name: 'Release & rehold this car' })
            // Call .isVisible to perform this step.
            .isVisible()
            // Call .catch to perform this step.
            .catch(() => false)
        // Continue the surrounding logic with this statement.
        ) {
          // Update state with the right-hand side value.
          state = 'rehold';
          // Return the resulting value to the caller.
          return 'rehold';
        }
        // Evaluate the condition and enter the branch when it is true.
        if (
          // Wait until the asynchronous operation resolves.
          await page
            // Call .getByRole to perform this step.
            .getByRole('button', { name: 'Release existing reservation' })
            // Call .isVisible to perform this step.
            .isVisible()
            // Call .catch to perform this step.
            .catch(() => false)
        // Continue the surrounding logic with this statement.
        ) {
          // Update state with the right-hand side value.
          state = 'release';
          // Return the resulting value to the caller.
          return 'release';
        }
        // Evaluate the condition and enter the branch when it is true.
        if (await page.getByRole('button', { name: 'Retry' }).isVisible().catch(() => false)) {
          // Update state with the right-hand side value.
          state = 'retry';
          // Return the resulting value to the caller.
          return 'retry';
        }
        // Return the resulting value to the caller.
        return null;
      },
      // Contribute this line to the enclosing declaration or statement.
      { timeout }
    )
    // Call .not.toBeNull to perform this step.
    .not.toBeNull();

  // Return the resulting value to the caller.
  return state!;
}

/** Wait out server rate-limit window by re-opening the order page until not rate-limited. */
async function waitOutRateLimit(
  // Provide the page field value.
  page: Page,
  // Provide the car id field value.
  carId: number,
  // Provide the range field value.
  range: AllocatedFutureRange,
  // Contribute this line to the enclosing declaration or statement.
  options?: { hotelDelivery?: boolean; extrasCodes?: string[] }
// Continue the surrounding logic with this statement.
): Promise<OrderPageState> {
  // Continue the surrounding logic with this statement.
  let recovered: OrderPageState = 'rate_limited';
  // Wait until the asynchronous operation resolves.
  await expect
    // Call .poll to perform this step.
    .poll(
      // Call async to perform this step.
      async () => {
        // Wait until the asynchronous operation resolves.
        await page.goto(buildOrderUrl(carId, range, options));
        // Store the awaited result in recovered.
        recovered = await waitForOrderPageState(page);
        // Return the resulting value to the caller.
        return recovered;
      },
      // Contribute this line to the enclosing declaration or statement.
      { timeout: 60_000, intervals: [2_000, 3_000, 5_000, 8_000] }
    )
    // Call .not.toBe to perform this step.
    .not.toBe('rate_limited');
  // Return the resulting value to the caller.
  return recovered;
}

/**
 * Open order page once without cleaning up conflicts — for concurrent-hold races.
 * Returns `review` if this session won the hold, otherwise `unavailable`.
 */
export async function tryOpenOrderHold(
  // Provide the page field value.
  page: Page,
  // Provide the car id field value.
  carId: number,
  // Provide the range field value.
  range: AllocatedFutureRange,
  // Contribute this line to the enclosing declaration or statement.
  options?: { hotelDelivery?: boolean; extrasCodes?: string[] }
// Continue the surrounding logic with this statement.
): Promise<'review' | 'unavailable' | 'rate_limited'> {
  // Wait until the asynchronous operation resolves.
  await page.goto('/');
  // Wait until the asynchronous operation resolves.
  await page.goto(buildOrderUrl(carId, range, options));
  // Create the state constant.
  const state = await waitForOrderPageState(page);
  // Evaluate the condition and enter the branch when it is true.
  if (state === 'review') return 'review';
  // Evaluate the condition and enter the branch when it is true.
  if (state === 'rate_limited') return 'rate_limited';
  // Return the resulting value to the caller.
  return 'unavailable';
}

// Export the async openOrderAndResolveConflict function.
export async function openOrderAndResolveConflict(
  // Provide the page field value.
  page: Page,
  // Provide the car id field value.
  carId: number,
  // Provide the range field value.
  range: AllocatedFutureRange,
  // Contribute this line to the enclosing declaration or statement.
  options?: { hotelDelivery?: boolean; extrasCodes?: string[] }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Warm the session/CSRF cookie before the order POST.
  await page.goto('/');

  // Iterate using the loop initializer, condition, and step.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    // Wait until the asynchronous operation resolves.
    await page.goto(buildOrderUrl(carId, range, options));

    // Initialize the mutable state variable.
    let state = await waitForOrderPageState(page);

    // Evaluate the condition and enter the branch when it is true.
    if (state === 'rate_limited') {
      // Store the awaited result in state.
      state = await waitOutRateLimit(page, carId, range, options);
    }

    // Evaluate the condition and enter the branch when it is true.
    if (state === 'review') return;

    // Evaluate the condition and enter the branch when it is true.
    if (state === 'retry') {
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Retry' }).click();
      // Initialize the mutable after retry variable.
      let afterRetry = await waitForOrderPageState(page);
      // Evaluate the condition and enter the branch when it is true.
      if (afterRetry === 'rate_limited') {
        // Store the awaited result in afterRetry.
        afterRetry = await waitOutRateLimit(page, carId, range, options);
      }
      // Evaluate the condition and enter the branch when it is true.
      if (afterRetry === 'review') return;
      // CSRF recovered but still conflicted — clear leftover holds once, then recreate.
      await cleanupReservationsForCar(carId);
      // Continue with the next loop iteration.
      continue;
    }

    // Evaluate the condition and enter the branch when it is true.
    if (state === 'rehold') {
      // Wait until the asynchronous operation resolves.
      await clickWhenEnabled(page.getByRole('button', { name: 'Release & rehold this car' }));
      // Create the after constant.
      const after = await waitForOrderPageState(page);
      // Evaluate the condition and enter the branch when it is true.
      if (after === 'review') return;
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
      // Continue with the next loop iteration.
      continue;
    }

    // Evaluate the condition and enter the branch when it is true.
    if (state === 'release') {
      // Wait until the asynchronous operation resolves.
      await clickWhenEnabled(page.getByRole('button', { name: 'Release existing reservation' }));
      // Continue with the next loop iteration.
      continue;
    }

    // Wait until the asynchronous operation resolves.
    await cleanupReservationsForCar(carId);
  }

  // Final fallback: clear leftover holds, leave the previous view, then open once more.
  await cleanupReservationsForCar(carId);
  // Wait until the asynchronous operation resolves.
  await page.goto('/');
  // Wait until the asynchronous operation resolves.
  await page.goto(buildOrderUrl(carId, range, options));
  // Wait until the asynchronous operation resolves.
  await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
    // Provide the timeout field value.
    timeout: 20_000,
  });
}

// Export the async continueToCheckoutAndFillGuest function.
export async function continueToCheckoutAndFillGuest(
  // Provide the page field value.
  page: Page,
  // Provide the car id field value.
  carId: number,
  // Update guest with the right-hand side value.
  guest = E2E_GUEST
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
    // Provide the timeout field value.
    timeout: 20_000,
  });
  // Wait until the asynchronous operation resolves.
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  // Wait until the asynchronous operation resolves.
  await page.waitForURL(new RegExp(`/checkout/${carId}`));

  // Create the full name constant.
  const fullName = page.getByLabel('Full name');
  // Create the load error constant.
  const loadError = page.getByTestId('checkout-load-error');
  // Create the missing details constant.
  const missingDetails = page.getByText('Missing booking details.');

  // Wait until the asynchronous operation resolves.
  await expect
    // Call .poll to perform this step.
    .poll(
      // Call async to perform this step.
      async () => {
        // Evaluate the condition and enter the branch when it is true.
        if (await fullName.isVisible().catch(() => false)) return 'form';
        // Evaluate the condition and enter the branch when it is true.
        if (await loadError.isVisible().catch(() => false)) return 'load_error';
        // Evaluate the condition and enter the branch when it is true.
        if (await missingDetails.isVisible().catch(() => false)) return 'missing';
        // Return the resulting value to the caller.
        return null;
      },
      // Contribute this line to the enclosing declaration or statement.
      { timeout: 30_000 }
    )
    // Call .not.toBeNull to perform this step.
    .not.toBeNull();

  // Evaluate the condition and enter the branch when it is true.
  if (await loadError.isVisible().catch(() => false)) {
    // Throw an error to stop the current control flow.
    throw new Error(`Checkout failed to load: ${await loadError.innerText()}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (await missingDetails.isVisible().catch(() => false)) {
    // Throw an error to stop the current control flow.
    throw new Error('Checkout missing booking query params after Continue to checkout');
  }

  // Wait until the asynchronous operation resolves.
  await fullName.fill(guest.fullName);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Phone number').fill(guest.phoneNumber);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Email').fill(guest.email);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Address').fill(guest.address);
  // Create the hotel constant.
  const hotel = page.getByLabel('Hotel name (optional)');
  // Filling hotel name forces hotelDelivery pricing at checkout — only set when provided.
  if (guest.hotelName && (await hotel.isVisible().catch(() => false))) {
    // Wait until the asynchronous operation resolves.
    await hotel.fill(guest.hotelName);
  }
}

/** Parse a displayed EUR amount like "€220.00" or "220,00 €" into a number. */
export function parseDisplayedPrice(text: string): number {
  // Create the normalized constant.
  const normalized = text.replace(/\s/g, ' ').trim();
  // Create the match constant.
  const match = normalized.match(/(\d+)[.,](\d{2})/);
  // Evaluate the condition and enter the branch when it is true.
  if (!match) {
    // Throw an error to stop the current control flow.
    throw new Error(`parseDisplayedPrice: could not parse "${text}"`);
  }
  // Return the resulting value to the caller.
  return Number(`${match[1]}.${match[2]}`);
}

/** Read the bold Total amount from OrderSummary / PriceBreakdownView. */
export async function readOrderSummaryTotal(page: Page): Promise<number> {
  // Create the amount constant.
  const amount = page
    // Call .locator to perform this step.
    .locator('div.flex.justify-between')
    // Call .filter to perform this step.
    .filter({ has: page.getByText('Total', { exact: true }) })
    // Call .last to perform this step.
    .last()
    // Call .locator to perform this step.
    .locator('span')
    // Call .last to perform this step.
    .last();
  // Wait until the asynchronous operation resolves.
  await amount.waitFor({ state: 'visible', timeout: 15_000 });
  // Return the resulting value to the caller.
  return parseDisplayedPrice(await amount.innerText());
}
