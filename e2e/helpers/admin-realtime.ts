// Contribute this line to the enclosing declaration or statement.
import type { Page } from '@playwright/test';
// Import named exports from '@playwright/test'.
import { expect } from '@playwright/test';
// Import named exports from './test-env'.
import { API_URL } from './test-env';

/** Wait until the admin LiveIndicator reports a live SSE connection. */
export async function waitForAdminLive(page: Page, timeout = 30_000): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await expect(page.getByTitle(/Realtime updates:\s*Live/i).first()).toBeVisible({ timeout });
}

/** Wait for a high-signal realtime toast message. */
export async function waitForAdminRealtimeToast(
  // Provide the page field value.
  page: Page,
  // Provide the match field value.
  match: string | RegExp,
  // Update timeout with the right-hand side value.
  timeout = 20_000
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await expect(page.getByText(match)).toBeVisible({ timeout });
}

// Export the wait for admin sse event options type.
export type WaitForAdminSseEventOptions = {
  // Provide the type field value.
  type: string;
  // Contribute this line to the enclosing declaration or statement.
  timeoutMs?: number;
  /** Invoked after EventSource connects. */
  trigger?: () => Promise<void>;
};

/**
 * Open an EventSource in the page context (cookie session) and wait for an event type.
 * Runs `trigger` after `onopen` so the publish happens after subscribe.
 */
export async function waitForAdminSseEvent(
  // Provide the page field value.
  page: Page,
  // Provide the opts field value.
  opts: WaitForAdminSseEventOptions
// Continue the surrounding logic with this statement.
): Promise<Record<string, unknown>> {
  // Create the timeout ms constant.
  const timeoutMs = opts.timeoutMs ?? 25_000;
  // Create the stream url constant.
  const streamUrl = `${API_URL}/api/v1/admin/realtime/stream`;
  // Create the event type constant.
  const eventType = opts.type;

  // Wait until the asynchronous operation resolves.
  await page.evaluate(() => {
    // Create the w constant.
    const w = window as unknown as { __sseConnected?: boolean; __ssePayload?: unknown };
    // Update w.__sseConnected with the right-hand side value.
    w.__sseConnected = false;
    // Update w.__ssePayload with the right-hand side value.
    w.__ssePayload = null;
  });

  // Wait until the asynchronous operation resolves.
  await page.evaluate(
    // Continue the surrounding logic with this statement.
    ({ url, type }) => {
      // Create the w constant.
      const w = window as unknown as {
        // Contribute this line to the enclosing declaration or statement.
        __sseConnected?: boolean;
        // Contribute this line to the enclosing declaration or statement.
        __ssePayload?: unknown;
        // Contribute this line to the enclosing declaration or statement.
        __sseSource?: EventSource;
      };
      // Evaluate the condition and enter the branch when it is true.
      if (w.__sseSource) {
        // Call w.__sseSource.close to perform this step.
        w.__sseSource.close();
      }
      // Create the source constant.
      const source = new EventSource(url, { withCredentials: true });
      // Update w.__sseSource with the right-hand side value.
      w.__sseSource = source;
      // Update source.onopen with the right-hand side value.
      source.onopen = () => {
        // Update w.__sseConnected with the right-hand side value.
        w.__sseConnected = true;
      };
      // Call source.addEventListener to perform this step.
      source.addEventListener(type, (evt) => {
        // Start a try block for operations that may fail.
        try {
          // Update w.__ssePayload with the right-hand side value.
          w.__ssePayload = JSON.parse((evt as MessageEvent).data);
        // Contribute this line to the enclosing declaration or statement.
        } catch {
          // Update w.__ssePayload with the right-hand side value.
          w.__ssePayload = { raw: (evt as MessageEvent).data };
        }
        // Call source.close to perform this step.
        source.close();
      });
    },
    // Contribute this line to the enclosing declaration or statement.
    { url: streamUrl, type: eventType }
  );

  // Wait until the asynchronous operation resolves.
  await expect
    // Call .poll to perform this step.
    .poll(
      // Call async to perform this step.
      async () =>
        // Call page.evaluate to perform this step.
        page.evaluate(
          // Continue the surrounding logic with this statement.
          () => Boolean((window as unknown as { __sseConnected?: boolean }).__sseConnected)
        ),
      // Contribute this line to the enclosing declaration or statement.
      { timeout: 15_000 }
    )
    // Call .toBe to perform this step.
    .toBe(true);

  // Evaluate the condition and enter the branch when it is true.
  if (opts.trigger) {
    // Wait until the asynchronous operation resolves.
    await opts.trigger();
  }

  // Wait until the asynchronous operation resolves.
  await expect
    // Call .poll to perform this step.
    .poll(
      // Call async to perform this step.
      async () =>
        // Call page.evaluate to perform this step.
        page.evaluate(
          // Continue the surrounding logic with this statement.
          () => (window as unknown as { __ssePayload?: unknown }).__ssePayload != null
        ),
      // Contribute this line to the enclosing declaration or statement.
      { timeout: timeoutMs }
    )
    // Call .toBe to perform this step.
    .toBe(true);

  // Return the resulting value to the caller.
  return page.evaluate(
    // Continue the surrounding logic with this statement.
    () =>
      // Continue the surrounding logic with this statement.
      (window as unknown as { __ssePayload: Record<string, unknown> }).__ssePayload
  );
}

/** Run `fn` and assert the page URL did not change (no full navigation/reload). */
export async function expectUrlUnchanged(
  // Provide the page field value.
  page: Page,
  // Provide the fn field value.
  fn: () => Promise<void>
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the before constant.
  const before = page.url();
  // Wait until the asynchronous operation resolves.
  await fn();
  // Assert that the value matches the intended expectation.
  expect(page.url()).toBe(before);
}
