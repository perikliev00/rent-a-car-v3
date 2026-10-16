/** Horizontally scrollable customer-quote carousel for the home page. */
import { useRef } from 'react';
import { reviews } from '../../data/marketingAssets';

/**
 * Horizontally scrollable customer-quote carousel for the home page.
 *
 * @returns Review cards in a snap scroller with a “next” control.
 * @remarks Side effect: `scrollNext` mutates the scroller’s scrollLeft smoothly.
 */
export function ReviewsCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  /** Scroll by roughly one card width (plus gap) toward the next review. */
  const scrollNext = () => {
    const el = scrollerRef.current;
    if (!el) return;
    // Prefer measuring a real card so the step stays aligned with snap points.
    const card = el.querySelector<HTMLElement>('[data-review-card]');
    const step = card ? card.offsetWidth + 16 : 280;
    el.scrollBy({ left: step, behavior: 'smooth' });
  };

  return (
    <section className="bg-[var(--color-surface)] py-12 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative">
          <div
            ref={scrollerRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-thin"
            style={{ scrollbarWidth: 'none' }}
          >
            {reviews.map((review) => (
              <blockquote
                key={`${review.name}-${review.location}`}
                data-review-card
                className="w-[min(100%,17.5rem)] shrink-0 snap-start border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-5 py-5 shadow-[var(--shadow-soft)]"
              >
                <div className="flex gap-0.5 text-[var(--color-accent)]" aria-label="5 star rating">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className="text-base leading-none">
                      ★
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                  “{review.quote}”
                </p>
                <footer className="mt-4 font-display text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-navy)]">
                  {review.name}
                </footer>
              </blockquote>
            ))}
          </div>

          <button
            type="button"
            onClick={scrollNext}
            aria-label="Next reviews"
            className="absolute -right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-elevated)] text-[var(--color-navy)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--color-accent)] sm:right-0"
          >
            <span aria-hidden className="text-lg font-bold">
              ›
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
