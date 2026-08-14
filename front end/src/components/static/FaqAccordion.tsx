import { useId, useState } from 'react';

export type FaqItem = {
  q: string;
  a: string;
};

interface FaqAccordionProps {
  items: FaqItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const baseId = useId();
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
