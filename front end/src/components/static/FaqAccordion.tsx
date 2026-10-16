/**
 * Accessible single-open FAQ accordion used on the static FAQ page.
 */
import { useId, useState } from 'react';

/** One question/answer pair rendered by {@link FaqAccordion}. */
export type FaqItem = {
  q: string;
  a: string;
};

interface FaqAccordionProps {
  items: FaqItem[];
}

/**
 * Accessible single-open FAQ accordion.
 *
 * @param props.items - Ordered question/answer pairs.
 * @returns A bordered accordion list; only one panel is expanded at a time.
 * @remarks Initial state opens the first item (`index 0`); clicking an open item collapses it.
 */
export function FaqAccordion({ items }: FaqAccordionProps) {
  const baseId = useId();
  // Start with the first question expanded for scannability.
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-[var(--color-line)] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-soft)]">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;

        return (
          <div key={item.q}>
            <h2 className="font-display text-base font-semibold text-[var(--color-ink)] sm:text-lg">
              <button
                type="button"
                id={buttonId}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--color-surface)] sm:px-6"
                aria-expanded={isOpen}
                aria-controls={panelId}
                // Toggle: open this panel, or collapse if it is already open.
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span>{item.q}</span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-line)] text-sm text-[var(--color-accent-ink)] transition-transform duration-200 ease-[var(--ease-out)] ${isOpen ? 'rotate-45 bg-[var(--color-accent-muted)]' : ''}`}
                  aria-hidden="true"
                >
                  +
                </span>
              </button>
            </h2>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-5 text-[var(--color-muted)] leading-relaxed sm:px-6"
            >
              {isOpen ? <p>{item.a}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
