// Contribute this line to the enclosing declaration or statement.
import type { Page } from '@playwright/test';

/** Document-level horizontal overflow (not intentional inner scrollers). */
export async function documentOverflowPx(page: Page): Promise<number> {
  // Return the resulting value to the caller.
  return page.evaluate(() => {
    // Create the doc constant.
    const doc = document.documentElement;
    // Return the resulting value to the caller.
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
}

// Export the async expectNoDocumentOverflow function.
export async function expectNoDocumentOverflow(page: Page, maxPx = 1): Promise<void> {
  // Create the overflow constant.
  const overflow = await documentOverflowPx(page);
  // Evaluate the condition and enter the branch when it is true.
  if (overflow > maxPx) {
    // Create the offenders constant.
    const offenders = await page.evaluate(() => {
      // Create the doc w constant.
      const docW = document.documentElement.clientWidth;
      // Create the nodes constant.
      const nodes = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
      // Return the resulting value to the caller.
      return nodes
        // Call .filter to perform this step.
        .filter((el) => {
          // Create the r constant.
          const r = el.getBoundingClientRect();
          // Return the resulting value to the caller.
          return r.width > 0 && r.right > docW + 1;
        })
        // Call .slice to perform this step.
        .slice(0, 8)
        // Call .map to perform this step.
        .map((el) => ({
          // Provide the tag field value.
          tag: el.tagName,
          // Provide the class name field value.
          className: String(el.className).slice(0, 80),
          // Provide the right field value.
          right: Math.round(el.getBoundingClientRect().right),
        }));
    });
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `Document horizontal overflow ${overflow}px; offenders=${JSON.stringify(offenders)}`
    );
  }
}
