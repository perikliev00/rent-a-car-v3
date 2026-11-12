/**
 * Read-only order detail for staff follow-up.
 */
import { useParams, Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from '../../api/admin/orders'.
import { getAdminOrder } from '../../api/admin/orders';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../utils/format'.
import { formatPrice } from '../../utils/format';
// Import named exports from '../../types/api'.
import { getCarFromOrder } from '../../types/api';
// Import named exports from '../../components/booking/PriceBreakdownView'.
import { PriceBreakdownView } from '../../components/booking/PriceBreakdownView';

/** Read-only order detail for staff follow-up. */
export function AdminOrderDetailPage() {
  // Destructure object properties into local variables.
  const { id } = useParams<{ id: string }>();
  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'order', id],
    // Provide the query fn field value.
    queryFn: () => getAdminOrder(id!),
    // Provide the enabled field value.
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  // Create the order constant.
  const order = data?.order;
  if (!order) return <p>Order not found</p>;

  // Create the car constant.
  const car = getCarFromOrder(order);
  // Create the breakdown constant.
  const breakdown = order.priceSnapshot
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
    // Contribute this line to the enclosing declaration or statement.
    : null;

  // Return control to the caller with the following value.
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
