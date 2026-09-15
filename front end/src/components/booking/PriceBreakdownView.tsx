import type { PriceBreakdown } from '../../types/api';
import { formatPrice } from '../../utils/format';

export function PriceBreakdownView({ breakdown }: { breakdown: PriceBreakdown }) {
  return (
    <div className="min-w-0 space-y-2 border-t border-[var(--color-line)] pt-4 text-sm">
      {breakdown.lines.map((line, index) => (
        <div key={`${line.code}-${index}`} className="flex min-w-0 justify-between gap-3">
          <span className="min-w-0 break-words text-[var(--color-muted)]">{line.label}</span>
          <span className={`shrink-0 ${line.amount < 0 ? 'text-[var(--color-accent-ink)]' : ''}`}>
            {formatPrice(line.amount)}
          </span>
        </div>
      ))}
      <div className="flex min-w-0 justify-between gap-3 border-t border-[var(--color-line)] pt-2 text-base font-bold">
        <span>Total</span>
        <span className="shrink-0 text-[var(--color-accent-ink)]">{formatPrice(breakdown.totalPrice)}</span>
      </div>
      {breakdown.deposit > 0 && (
        <div className="flex min-w-0 justify-between gap-3">
          <span className="min-w-0 text-[var(--color-muted)]">Deposit (at pickup)</span>
          <span className="shrink-0">{formatPrice(breakdown.deposit)}</span>
        </div>
      )}
    </div>
  );
}
