# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\specs\booking-happy-path.spec.ts >> booking-happy-path >> Booking happy path >> guest can search, checkout, finalize via webhook, and admin sees the order
- Location: e2e\specs\booking-happy-path.spec.ts:52:9

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/search?pickup-date=2026-11-27&return-date=2026-12-01&pickup-time=10%3A00&return-time=10%3A00&pickup-location=office&return-location=office", waiting until "load"

```

# Test source

```ts
  1   | import type { Page, Locator } from '@playwright/test';
  2   | import { expect } from '@playwright/test';
  3   | import type { AllocatedFutureRange } from './dates';
  4   | import { E2E_GUEST } from './test-env';
  5   | import { cleanupReservationsForCar } from './db';
  6   | 
  7   | export function buildSearchQuery(
  8   |   range: AllocatedFutureRange,
  9   |   extras?: { pickupLocation?: string; returnLocation?: string; page?: number }
  10  | ): string {
  11  |   const params = new URLSearchParams({
  12  |     'pickup-date': range.pickupDate,
  13  |     'return-date': range.returnDate,
  14  |     'pickup-time': range.pickupTime,
  15  |     'return-time': range.returnTime,
  16  |     'pickup-location': extras?.pickupLocation ?? 'office',
  17  |     'return-location': extras?.returnLocation ?? 'office',
  18  |   });
  19  |   if (extras?.page) params.set('page', String(extras.page));
  20  |   return params.toString();
  21  | }
  22  | 
  23  | export function buildOrderUrl(
  24  |   carId: number,
  25  |   range: AllocatedFutureRange,
  26  |   extras?: {
  27  |     pickupLocation?: string;
  28  |     returnLocation?: string;
  29  |     hotelDelivery?: boolean;
  30  |     extrasCodes?: string[];
  31  |   }
  32  | ): string {
  33  |   const params = new URLSearchParams({
  34  |     'pickup-date': range.pickupDate,
  35  |     'return-date': range.returnDate,
  36  |     'pickup-time': range.pickupTime,
  37  |     'return-time': range.returnTime,
  38  |     'pickup-location': extras?.pickupLocation ?? 'office',
  39  |     'return-location': extras?.returnLocation ?? 'office',
  40  |   });
  41  |   if (extras?.hotelDelivery) params.set('hotelDelivery', '1');
  42  |   if (extras?.extrasCodes?.length) params.set('extras', extras.extrasCodes.join(','));
  43  |   return `/order/${carId}?${params.toString()}`;
  44  | }
  45  | 
  46  | export async function fillHomeSearch(page: Page, range: AllocatedFutureRange): Promise<void> {
  47  |   // Date/time controls are custom pickers (buttons), not native inputs — drive search via URL.
> 48  |   await page.goto(`/search?${buildSearchQuery(range)}`);
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  49  |   await page.waitForURL(/\/search/);
  50  | }
  51  | 
  52  | type OrderPageState = 'review' | 'rehold' | 'release' | 'retry' | 'rate_limited';
  53  | 
  54  | async function clickWhenEnabled(locator: Locator, timeout = 15_000): Promise<void> {
  55  |   await expect(locator).toBeEnabled({ timeout });
  56  |   await locator.click();
  57  | }
  58  | 
  59  | async function waitForOrderPageState(page: Page, timeout = 20_000): Promise<OrderPageState> {
  60  |   // Do not use locator.or() across conflict copy + Retry — they co-exist and trip strict mode.
  61  |   let state: OrderPageState | null = null;
  62  |   await expect
  63  |     .poll(
  64  |       async () => {
  65  |         if (await page.getByRole('heading', { name: 'Review your booking' }).isVisible().catch(() => false)) {
  66  |           state = 'review';
  67  |           return 'review';
  68  |         }
  69  |         if (await page.getByText(/Too many requests/i).isVisible().catch(() => false)) {
  70  |           state = 'rate_limited';
  71  |           return 'rate_limited';
  72  |         }
  73  |         if (
  74  |           await page
  75  |             .getByRole('button', { name: 'Release & rehold this car' })
  76  |             .isVisible()
  77  |             .catch(() => false)
  78  |         ) {
  79  |           state = 'rehold';
  80  |           return 'rehold';
  81  |         }
  82  |         if (
  83  |           await page
  84  |             .getByRole('button', { name: 'Release existing reservation' })
  85  |             .isVisible()
  86  |             .catch(() => false)
  87  |         ) {
  88  |           state = 'release';
  89  |           return 'release';
  90  |         }
  91  |         if (await page.getByRole('button', { name: 'Retry' }).isVisible().catch(() => false)) {
  92  |           state = 'retry';
  93  |           return 'retry';
  94  |         }
  95  |         return null;
  96  |       },
  97  |       { timeout }
  98  |     )
  99  |     .not.toBeNull();
  100 | 
  101 |   return state!;
  102 | }
  103 | 
  104 | /** Wait out server rate-limit window by re-opening the order page until not rate-limited. */
  105 | async function waitOutRateLimit(
  106 |   page: Page,
  107 |   carId: number,
  108 |   range: AllocatedFutureRange,
  109 |   options?: { hotelDelivery?: boolean; extrasCodes?: string[] }
  110 | ): Promise<OrderPageState> {
  111 |   let recovered: OrderPageState = 'rate_limited';
  112 |   await expect
  113 |     .poll(
  114 |       async () => {
  115 |         await page.goto(buildOrderUrl(carId, range, options));
  116 |         recovered = await waitForOrderPageState(page);
  117 |         return recovered;
  118 |       },
  119 |       { timeout: 60_000, intervals: [2_000, 3_000, 5_000, 8_000] }
  120 |     )
  121 |     .not.toBe('rate_limited');
  122 |   return recovered;
  123 | }
  124 | 
  125 | /**
  126 |  * Open order page once without cleaning up conflicts — for concurrent-hold races.
  127 |  * Returns `review` if this session won the hold, otherwise `unavailable`.
  128 |  */
  129 | export async function tryOpenOrderHold(
  130 |   page: Page,
  131 |   carId: number,
  132 |   range: AllocatedFutureRange,
  133 |   options?: { hotelDelivery?: boolean; extrasCodes?: string[] }
  134 | ): Promise<'review' | 'unavailable' | 'rate_limited'> {
  135 |   await page.goto('/');
  136 |   await page.goto(buildOrderUrl(carId, range, options));
  137 |   const state = await waitForOrderPageState(page);
  138 |   if (state === 'review') return 'review';
  139 |   if (state === 'rate_limited') return 'rate_limited';
  140 |   return 'unavailable';
  141 | }
  142 | 
  143 | export async function openOrderAndResolveConflict(
  144 |   page: Page,
  145 |   carId: number,
  146 |   range: AllocatedFutureRange,
  147 |   options?: { hotelDelivery?: boolean; extrasCodes?: string[] }
  148 | ): Promise<void> {
```