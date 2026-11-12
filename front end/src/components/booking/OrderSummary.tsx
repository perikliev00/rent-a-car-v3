/**
 * Booking summary card for order/checkout: vehicle, trip window, and pricing.
 * Prefers live `priceBreakdown`; falls back to a persisted `priceSnapshot` or
 * a simple rental + delivery/return fee layout when no lines are present.
 */
import type { OrderPageData, PriceBreakdown as PriceBreakdownType } from '../../types/api';
// Import named exports from '../../utils/format'.
import { formatPrice } from '../../utils/format';
// Import named exports from '../ui/Card'.
import { Card, CardBody, CardHeader } from '../ui/Card';
// Import named exports from './PriceBreakdownView'.
import { PriceBreakdownView } from './PriceBreakdownView';

/**
 * Side-panel summary of the pending order and its price quote.
 *
 * @param props.order - Order page payload including car, dates, and pricing fields.
 * @returns Card with vehicle, pickup/return, and price breakdown or fee fallback.
 */
export function OrderSummary({ order }: { order: OrderPageData }) {
  // Prefer the live breakdown; snapshot is used when rehydrating an older order.
  const breakdown: PriceBreakdownType | null =
    // Contribute this line to the enclosing declaration or statement.
    order.priceBreakdown ||
    // Continue the surrounding logic with this statement.
    (order.priceSnapshot
      // Contribute this line to the enclosing declaration or statement.
      ? {
          // Provide the lines field value.
          lines: order.priceSnapshot.lines || [],
          // Provide the total price field value.
          totalPrice: order.priceSnapshot.totalPrice ?? order.totalPrice,
          // Provide the deposit field value.
          deposit: order.priceSnapshot.deposit ?? order.deposit ?? 0,
          // Provide the currency field value.
          currency: 'EUR',
        }
      // Continue the surrounding logic with this statement.
      : null);

  // Return control to the caller with the following value.
  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
          Booking summary
        </h2>
      </CardHeader>
      <CardBody className="min-w-0 space-y-4">
        {order.car && (
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Vehicle
            </p>
            <p className="mt-1 break-words font-medium text-[var(--color-ink)]">{order.car.name}</p>
          </div>
        )}
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Pickup
            </p>
            <p className="mt-1 break-words font-medium text-[var(--color-ink)]">
              {order.pickupDate} at {order.pickupTime}
            </p>
            <p className="break-words text-sm text-[var(--color-muted)]">{order.pickupLocationDisplay}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Return
            </p>
            <p className="mt-1 break-words font-medium text-[var(--color-ink)]">
              {order.returnDate} at {order.returnTime}
            </p>
            <p className="break-words text-sm text-[var(--color-muted)]">{order.returnLocationDisplay}</p>
          </div>
        </div>
        {breakdown?.lines?.length ? (
          <PriceBreakdownView breakdown={breakdown} />
        ) : (
          <div className="min-w-0 space-y-2 border-t border-[var(--color-line)] pt-4 text-sm">
            <div className="flex min-w-0 justify-between gap-3">
              <span className="min-w-0 text-[var(--color-muted)]">Rental ({order.rentalDays} days)</span>
              <span className="shrink-0">{formatPrice(order.totalPrice - order.deliveryPrice - order.returnPrice)}</span>
            </div>
            <div className="flex min-w-0 justify-between gap-3">
              <span className="min-w-0 text-[var(--color-muted)]">Delivery fee</span>
              <span className="shrink-0">{formatPrice(order.deliveryPrice)}</span>
            </div>
            <div className="flex min-w-0 justify-between gap-3">
              <span className="min-w-0 text-[var(--color-muted)]">Return fee</span>
              <span className="shrink-0">{formatPrice(order.returnPrice)}</span>
            </div>
            <div className="flex min-w-0 justify-between gap-3 border-t border-[var(--color-line)] pt-2 text-base font-bold">
              <span>Total</span>
              <span className="shrink-0 text-[var(--color-accent-ink)]">{formatPrice(order.totalPrice)}</span>
            </div>
            {(order.deposit ?? 0) > 0 && (
              <div className="flex min-w-0 justify-between gap-3">
                <span className="min-w-0 text-[var(--color-muted)]">Deposit (at pickup)</span>
                <span className="shrink-0">{formatPrice(order.deposit!)}</span>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
