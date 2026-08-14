import type { OrderPageData, PriceBreakdown as PriceBreakdownType } from '../../types/api';
import { formatPrice } from '../../utils/format';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { PriceBreakdownView } from './PriceBreakdownView';

export function OrderSummary({ order }: { order: OrderPageData }) {
  const breakdown: PriceBreakdownType | null =
    order.priceBreakdown ||
    (order.priceSnapshot
      ? {
          lines: order.priceSnapshot.lines || [],
          totalPrice: order.priceSnapshot.totalPrice ?? order.totalPrice,
          deposit: order.priceSnapshot.deposit ?? order.deposit ?? 0,
          currency: 'EUR',
        }
      : null);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
          Booking summary
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        {order.car && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Vehicle
            </p>
            <p className="mt-1 font-medium text-[var(--color-ink)]">{order.car.name}</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Pickup
            </p>
            <p className="mt-1 font-medium text-[var(--color-ink)]">
              {order.pickupDate} at {order.pickupTime}
            </p>
            <p className="text-sm text-[var(--color-muted)]">{order.pickupLocationDisplay}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Return
            </p>
            <p className="mt-1 font-medium text-[var(--color-ink)]">
              {order.returnDate} at {order.returnTime}
            </p>
            <p className="text-sm text-[var(--color-muted)]">{order.returnLocationDisplay}</p>
          </div>
        </div>
        {breakdown?.lines?.length ? (
          <PriceBreakdownView breakdown={breakdown} />
        ) : (
          <div className="space-y-2 border-t border-[var(--color-line)] pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Rental ({order.rentalDays} days)</span>
              <span>{formatPrice(order.totalPrice - order.deliveryPrice - order.returnPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Delivery fee</span>
              <span>{formatPrice(order.deliveryPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Return fee</span>
              <span>{formatPrice(order.returnPrice)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--color-line)] pt-2 text-base font-bold">
              <span>Total</span>
              <span className="text-[var(--color-accent-ink)]">{formatPrice(order.totalPrice)}</span>
            </div>
            {(order.deposit ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Deposit (at pickup)</span>
                <span>{formatPrice(order.deposit!)}</span>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
