import type { PriceBreakdown } from '../../types/api';
import { formatPrice } from '../../utils/format';

export function PriceBreakdownView({ breakdown }: { breakdown: PriceBreakdown }) {
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
