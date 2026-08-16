import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import type { AllocatedFutureRange } from './dates';
import { E2E_GUEST } from './test-env';
import { cleanupReservationsForCar } from './db';

export function buildSearchQuery(
  range: AllocatedFutureRange,
  extras?: { pickupLocation?: string; returnLocation?: string; page?: number }
): string {
  const params = new URLSearchParams({
    'pickup-date': range.pickupDate,
    'return-date': range.returnDate,
    'pickup-time': range.pickupTime,
    'return-time': range.returnTime,
    'pickup-location': extras?.pickupLocation ?? 'office',
    'return-location': extras?.returnLocation ?? 'office',
  });
  if (extras?.page) params.set('page', String(extras.page));
  return params.toString();
}

export function buildOrderUrl(
  carId: number,
  range: AllocatedFutureRange,
  extras?: {
    pickupLocation?: string;
    returnLocation?: string;
    hotelDelivery?: boolean;
    extrasCodes?: string[];
  }
): string {
  const params = new URLSearchParams({
    'pickup-date': range.pickupDate,
    'return-date': range.returnDate,
    'pickup-time': range.pickupTime,
    'return-time': range.returnTime,
    'pickup-location': extras?.pickupLocation ?? 'office',
    'return-location': extras?.returnLocation ?? 'office',
  });
  if (extras?.hotelDelivery) params.set('hotelDelivery', '1');
  if (extras?.extrasCodes?.length) params.set('extras', extras.extrasCodes.join(','));
  return `/order/${carId}?${params.toString()}`;
}

export async function fillHomeSearch(page: Page, range: AllocatedFutureRange): Promise<void> {
  // Date/time controls are custom pickers (buttons), not native inputs — drive search via URL.
  await page.goto(`/search?${buildSearchQuery(range)}`);
  await page.waitForURL(/\/search/);
}

async function clickWhenEnabled(locator: Locator, timeout = 15_000): Promise<void> {
  await expect(locator).toBeEnabled({ timeout });
  await locator.click();
}

type OrderPageState = 'review' | 'rehold' | 'release' | 'retry' | 'rate_limited';

async function waitForOrderPageState(page: Page, timeout = 20_000): Promise<OrderPageState> {
  // Do not use locator.or() across conflict copy + Retry — they co-exist and trip strict mode.
  let state: OrderPageState | null = null;
  await expect
    .poll(
      async () => {
        if (await page.getByRole('heading', { name: 'Review your booking' }).isVisible().catch(() => false)) {
          state = 'review';
          return 'review';
        }
        if (await page.getByText(/Too many requests/i).isVisible().catch(() => false)) {
          state = 'rate_limited';
          return 'rate_limited';
        }
        if (
          await page
            .getByRole('button', { name: 'Release & rehold this car' })
            .isVisible()
            .catch(() => false)
        ) {
          state = 'rehold';
          return 'rehold';
        }
        if (
          await page
            .getByRole('button', { name: 'Release existing reservation' })
            .isVisible()
            .catch(() => false)
        ) {
          state = 'release';
          return 'release';
        }
        if (await page.getByRole('button', { name: 'Retry' }).isVisible().catch(() => false)) {
          state = 'retry';
          return 'retry';
        }
        return null;
      },
      { timeout }
    )
    .not.toBeNull();

  return state!;
}

/**
 * Open order page once without cleaning up conflicts — for concurrent-hold races.
 * Returns `review` if this session won the hold, otherwise `unavailable`.
 */
export async function tryOpenOrderHold(
  page: Page,
  carId: number,
  range: AllocatedFutureRange,
  options?: { hotelDelivery?: boolean; extrasCodes?: string[] }
): Promise<'review' | 'unavailable' | 'rate_limited'> {
  await page.goto('/');
  await page.goto(buildOrderUrl(carId, range, options));
  const state = await waitForOrderPageState(page);
  if (state === 'review') return 'review';
  if (state === 'rate_limited') return 'rate_limited';
  return 'unavailable';
}

export async function openOrderAndResolveConflict(
  page: Page,
  carId: number,
  range: AllocatedFutureRange,
  options?: { hotelDelivery?: boolean; extrasCodes?: string[] }
): Promise<void> {
  // Warm the session/CSRF cookie before the order POST.
  await page.goto('/');

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto(buildOrderUrl(carId, range, options));

    const state = await waitForOrderPageState(page);

    if (state === 'review') return;

    if (state === 'rate_limited') {
      await page.waitForTimeout(2_500);
      continue;
    }

    if (state === 'retry') {
      await page.getByRole('button', { name: 'Retry' }).click();
      const afterRetry = await waitForOrderPageState(page);
      if (afterRetry === 'review') return;
      if (afterRetry === 'rate_limited') {
        await page.waitForTimeout(2_500);
        continue;
      }
      // CSRF recovered but still conflicted — clear leftover holds once, then recreate.
      await cleanupReservationsForCar(carId);
      continue;
    }

    if (state === 'rehold') {
      await clickWhenEnabled(page.getByRole('button', { name: 'Release & rehold this car' }));
      const after = await waitForOrderPageState(page);
      if (after === 'review') return;
      await cleanupReservationsForCar(carId);
      continue;
    }

    if (state === 'release') {
      await clickWhenEnabled(page.getByRole('button', { name: 'Release existing reservation' }));
      continue;
    }
  }

  // Final fallback: clear leftover holds, leave the previous view, then open once more.
  await cleanupReservationsForCar(carId);
  await page.goto('/');
  await page.goto(buildOrderUrl(carId, range, options));
  await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
    timeout: 20_000,
  });
}

export async function continueToCheckoutAndFillGuest(
  page: Page,
  carId: number,
  guest = E2E_GUEST
): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await page.waitForURL(new RegExp(`/checkout/${carId}`));
  await page.getByLabel('Full name').fill(guest.fullName);
  await page.getByLabel('Phone number').fill(guest.phoneNumber);
  await page.getByLabel('Email').fill(guest.email);
  await page.getByLabel('Address').fill(guest.address);
  const hotel = page.getByLabel('Hotel name (optional)');
  // Filling hotel name forces hotelDelivery pricing at checkout — only set when provided.
  if (guest.hotelName && (await hotel.isVisible().catch(() => false))) {
    await hotel.fill(guest.hotelName);
  }
}

/** Parse a displayed EUR amount like "€220.00" or "220,00 €" into a number. */
export function parseDisplayedPrice(text: string): number {
  const normalized = text.replace(/\s/g, ' ').trim();
  const match = normalized.match(/(\d+)[.,](\d{2})/);
  if (!match) {
    throw new Error(`parseDisplayedPrice: could not parse "${text}"`);
  }
  return Number(`${match[1]}.${match[2]}`);
}

/** Read the bold Total amount from OrderSummary / PriceBreakdownView. */
export async function readOrderSummaryTotal(page: Page): Promise<number> {
  const amount = page
    .locator('div.flex.justify-between')
    .filter({ has: page.getByText('Total', { exact: true }) })
    .last()
    .locator('span')
    .last();
  await amount.waitFor({ state: 'visible', timeout: 15_000 });
  return parseDisplayedPrice(await amount.innerText());
}
