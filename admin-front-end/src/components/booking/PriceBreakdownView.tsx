/**
 * Renders a priced quote line-item breakdown for admin order/pricing UIs.
 */
import type { PriceBreakdown } from '../../types/api';
// Import named exports from '../../utils/format'.
import { formatPrice } from '../../utils/format';

/**
 * Line items, total, and optional deposit row for a {@link PriceBreakdown}.
 * Negative line amounts are tinted as discounts.
 *
 * @param breakdown - Quote breakdown from pricing/order APIs
 */
export function PriceBreakdownView({ breakdown }: { breakdown: PriceBreakdown }) {
  // Return control to the caller with the following value.
  return (
    <div className="space-y-2 border-t border-[var(--color-line)] pt-4 text-sm">
      {breakdown.lines.map((line, index) => (
        <div key={`${line.code}-${index}`} className="flex justify-between gap-4">
          <span className="text-[var(--color-muted)]">{line.label}</span>
          <span className={line.amount < 0 ? 'text-[var(--color-accent-ink)]' : undefined}>
            {formatPrice(line.amount)}
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-[var(--color-line)] pt-2 text-base font-bold">
        <span>Total</span>
        <span className="text-[var(--color-accent-ink)]">{formatPrice(breakdown.totalPrice)}</span>
      </div>
      {breakdown.deposit > 0 && (
        <div className="flex justify-between">
          <span className="text-[var(--color-muted)]">Deposit (at pickup)</span>
          <span>{formatPrice(breakdown.deposit)}</span>
        </div>
      )}
    </div>
  );
}
