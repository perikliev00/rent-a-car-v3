import type { Page } from '@playwright/test';

/** Document-level horizontal overflow (not intentional inner scrollers). */
export async function documentOverflowPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
}

export async function expectNoDocumentOverflow(page: Page, maxPx = 1): Promise<void> {
  const overflow = await documentOverflowPx(page);
  if (overflow > maxPx) {
    const offenders = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const nodes = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
      return nodes
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > docW + 1;
        })
        .slice(0, 8)
        .map((el) => ({
          tag: el.tagName,
          className: String(el.className).slice(0, 80),
          right: Math.round(el.getBoundingClientRect().right),
        }));
    });
    throw new Error(
      `Document horizontal overflow ${overflow}px; offenders=${JSON.stringify(offenders)}`
    );
  }
}
