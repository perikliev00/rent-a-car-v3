import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAdminOrder } from '../../api/admin/orders';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { Button } from '../../components/ui/Button';
import { formatPrice } from '../../utils/format';
import { getCarFromOrder } from '../../types/api';
import { PriceBreakdownView } from '../../components/booking/PriceBreakdownView';

export function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => getAdminOrder(id!),
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  const order = data?.order;
  if (!order) return <p>Order not found</p>;

  const car = getCarFromOrder(order);
  const breakdown = order.priceSnapshot
    ? {
        lines: order.priceSnapshot.lines || [],
        totalPrice: order.priceSnapshot.totalPrice ?? order.totalPrice,
        deposit: order.priceSnapshot.deposit ?? order.deposit ?? 0,
        currency: 'EUR',
      }
    : null;

  return (
    <div className="mx-auto min-w-0 max-w-2xl">
      <Link to="/admin/orders" className="text-sm text-[var(--color-accent-ink)] hover:underline">
        ← Back to orders
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
        Order #{order.id}
      </h1>
      <Card className="mt-6">
        <CardBody className="space-y-4">
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-muted)]">Customer</p>
              <p className="break-words font-medium">{order.fullName}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-muted)]">Status</p>
              <p className="font-medium capitalize">{order.status}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-muted)]">Email</p>
              <p className="break-words">{order.email}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-muted)]">Phone</p>
              <p className="break-words">{order.phoneNumber}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-muted)]">Car</p>
              <p className="break-words">{car?.name ?? '—'}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-muted)]">Total</p>
              <p className="font-bold text-[var(--color-accent-ink)]">
                {formatPrice(order.totalPrice)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-muted)]">Pickup</p>
              <p className="break-words">
                {String(order.pickupDate).slice(0, 10)} {order.pickupTime} · {order.pickupLocation}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-muted)]">Return</p>
              <p className="break-words">
                {String(order.returnDate).slice(0, 10)} {order.returnTime} · {order.returnLocation}
              </p>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <p className="text-sm text-[var(--color-muted)]">Address</p>
              <p className="break-words">{order.address}</p>
            </div>
            {order.hotelName && (
              <div className="min-w-0 sm:col-span-2">
                <p className="text-sm text-[var(--color-muted)]">Hotel</p>
                <p className="break-words">{order.hotelName}</p>
              </div>
            )}
          </div>

          {breakdown?.lines?.length ? (
            <div>
              <h2 className="font-semibold">Price breakdown</h2>
              <PriceBreakdownView breakdown={breakdown} />
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Delivery</span>
                <span>{formatPrice(order.deliveryPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Return</span>
                <span>{formatPrice(order.returnPrice)}</span>
              </div>
              {(order.deposit ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Deposit</span>
                  <span>{formatPrice(order.deposit!)}</span>
                </div>
              )}
            </div>
          )}

          <Link to={`/admin/orders/${order.id}/edit`}>
            <Button variant="outline">Edit order</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
