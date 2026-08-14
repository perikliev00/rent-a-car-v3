import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { API_URL } from './test-env';

/** Wait until the admin LiveIndicator reports a live SSE connection. */
export async function waitForAdminLive(page: Page, timeout = 30_000): Promise<void> {
  await expect(page.getByTitle(/Realtime updates:\s*Live/i).first()).toBeVisible({ timeout });
}

/** Wait for a high-signal realtime toast message. */
export async function waitForAdminRealtimeToast(
  page: Page,
  match: string | RegExp,
  timeout = 20_000
): Promise<void> {
  await expect(page.getByText(match)).toBeVisible({ timeout });
}

export type WaitForAdminSseEventOptions = {
  type: string;
  timeoutMs?: number;
  /** Invoked after EventSource connects. */
  trigger?: () => Promise<void>;
};

/**
 * Open an EventSource in the page context (cookie session) and wait for an event type.
 * Runs `trigger` after `onopen` so the publish happens after subscribe.
 */
export async function waitForAdminSseEvent(
  page: Page,
  opts: WaitForAdminSseEventOptions
): Promise<Record<string, unknown>> {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const streamUrl = `${API_URL}/api/v1/admin/realtime/stream`;
  const eventType = opts.type;

  await page.evaluate(() => {
    (window as unknown as { __sseConnected?: boolean; __ssePayload?: unknown }).__sseConnected =
      false;
    (window as unknown as { __ssePayload?: unknown }).__ssePayload = null;
  });

  await page.evaluate(
    ({ url, type }) => {
      const w = window as unknown as {
        __sseConnected?: boolean;
        __ssePayload?: unknown;
        __sseSource?: EventSource;
      };
      if (w.__sseSource) {
        w.__sseSource.close();
      }
      const source = new EventSource(url, { withCredentials: true });
      w.__sseSource = source;
      source.onopen = () => {
        w.__sseConnected = true;
      };
      source.addEventListener(type, (evt) => {
        try {
          w.__ssePayload = JSON.parse((evt as MessageEvent).data);
        } catch {
          w.__ssePayload = { raw: (evt as MessageEvent).data };
        }
        source.close();
      });
    },
    { url: streamUrl, type: eventType }
  );

  await expect
    .poll(
      async () =>
        page.evaluate(
          () => Boolean((window as unknown as { __sseConnected?: boolean }).__sseConnected)
        ),
      { timeout: 15_000 }
    )
    .toBe(true);

  if (opts.trigger) {
    await opts.trigger();
  }

  await expect
    .poll(
      async () =>
        page.evaluate(
          () => (window as unknown as { __ssePayload?: unknown }).__ssePayload != null
        ),
      { timeout: timeoutMs }
    )
    .toBe(true);

  return page.evaluate(
    () =>
      (window as unknown as { __ssePayload: Record<string, unknown> }).__ssePayload
  );
}

/** Run `fn` and assert the page URL did not change (no full navigation/reload). */
export async function expectUrlUnchanged(
  page: Page,
  fn: () => Promise<void>
): Promise<void> {
  const before = page.url();
  await fn();
  expect(page.url()).toBe(before);
}
