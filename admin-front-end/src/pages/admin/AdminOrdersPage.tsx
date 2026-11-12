/**
 * Order list with filters, soft-delete bin, and restore/empty flows.
 */
import { useState } from 'react';
// Import named exports from 'react-router-dom'.
import { Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getAdminOrders,
  // Contribute this line to the enclosing declaration or statement.
  getDeletedOrders,
  // Contribute this line to the enclosing declaration or statement.
  getExpiredOrders,
  // Contribute this line to the enclosing declaration or statement.
  deleteAdminOrder,
  // Contribute this line to the enclosing declaration or statement.
  restoreAdminOrder,
  // Contribute this line to the enclosing declaration or statement.
  emptyDeletedOrders,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/admin/orders';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Input'.
import { Input } from '../../components/ui/Input';
// Import named exports from '../../components/ui/Select'.
import { Select } from '../../components/ui/Select';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/toastStore'.
import { toast } from '../../components/ui/toastStore';
// Import named exports from '../../utils/format'.
import { formatPrice } from '../../utils/format';
// Import named exports from '../../types/api'.
import { getCarFromOrder } from '../../types/api';
// Contribute this line to the enclosing declaration or statement.
import type { OrderStatus } from '../../types/api';

// Declare the Tab TypeScript type alias.
type Tab = 'active' | 'expired' | 'deleted';

/** Order list with filters, soft-delete bin, and restore/empty flows. */
export function AdminOrdersPage() {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [tab, setTab] = useState<Tab>('active');
  // Destructure array values into local variables.
  const [filters, setFilters] = useState({ status: '' as OrderStatus | '', startDate: '', endDate: '', search: '' });
  // Destructure array values into local variables.
  const [confirmEmpty, setConfirmEmpty] = useState('');

  // Create the active query constant.
  const activeQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'orders', filters],
    // Provide the query fn field value.
    queryFn: () => getAdminOrders(filters),
    // Provide the enabled field value.
    enabled: tab === 'active',
  });

  // Create the expired query constant.
  const expiredQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'orders', 'expired'],
    // Provide the query fn field value.
    queryFn: getExpiredOrders,
    // Provide the enabled field value.
    enabled: tab === 'expired',
  });

  // Create the deleted query constant.
  const deletedQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'orders', 'deleted'],
    // Provide the query fn field value.
    queryFn: getDeletedOrders,
    // Provide the enabled field value.
    enabled: tab === 'deleted',
  });

  // Create the delete mutation constant.
  const deleteMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: deleteAdminOrder,
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      // Call toast to perform this step.
      toast('Order moved to bin', 'success');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the restore mutation constant.
  const restoreMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: restoreAdminOrder,
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      // Call toast to perform this step.
      toast('Order restored', 'success');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the empty mutation constant.
  const emptyMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () => emptyDeletedOrders(confirmEmpty),
    // Provide the on success field value.
    onSuccess: (data) => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      // Call toast to perform this step.
      toast(`Permanently deleted ${data.deletedCount} orders`, 'success');
      // Call setConfirmEmpty to perform this step.
      setConfirmEmpty('');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the is loading constant.
  const isLoading = activeQuery.isLoading || expiredQuery.isLoading || deletedQuery.isLoading;
  // Create the orders constant.
  const orders =
    // Update tab with the right-hand side value.
    tab === 'active' ? activeQuery.data?.orders :
    // Update tab with the right-hand side value.
    tab === 'expired' ? expiredQuery.data?.orders :
    // Contribute this line to the enclosing declaration or statement.
    deletedQuery.data?.orders;

  // Return control to the caller with the following value.
  return (
    <div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">Orders</h1>
          <p className="mt-1 text-[var(--color-muted)]">Manage bookings and reservations</p>
        </div>
        <Link to="/admin/orders/new" className="shrink-0">
          <Button className="min-h-11 w-full sm:w-auto">Create order</Button>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(['active', 'expired', 'deleted'] as Tab[]).map((t) => (
          <Button key={t} variant={tab === t ? 'primary' : 'outline'} size="sm" onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      {tab === 'active' && (
        <Card className="mt-4">
          <CardBody>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Select
                label="Status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as OrderStatus | '' })}
                options={[
                  { value: '', label: 'All' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'active', label: 'Active' },
                  { value: 'expired', label: 'Expired' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
              <Input label="From" type="date" className="min-w-0" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
              <Input label="To" type="date" className="min-w-0" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
              <Input label="Search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Name, email, phone..." />
            </div>
          </CardBody>
        </Card>
      )}

      {tab === 'deleted' && deletedQuery.data && (
        <Card className="mt-4">
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">
              Deleted orders are kept for {deletedQuery.data.retentionDays} days.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Input
                label={`Type "${deletedQuery.data.emptyConfirmText}" to permanently delete all`}
                value={confirmEmpty}
                onChange={(e) => setConfirmEmpty(e.target.value)}
                className="max-w-md"
              />
              <Button
                variant="danger"
                size="sm"
                disabled={confirmEmpty !== deletedQuery.data.emptyConfirmText}
                loading={emptyMutation.isPending}
                onClick={() => emptyMutation.mutate()}
              >
                Empty bin
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <PageLoader />
      ) : (
        <Card className="mt-6">
          <CardBody className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4">Car</th>
                  <th className="pb-2 pr-4">Dates</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders?.map((order) => {
                  const car = getCarFromOrder(order);
                  return (
                    <tr key={order.id} className="border-b border-[var(--color-line)]/60">
                      <td className="py-2 pr-4 font-mono text-xs">#{order.id}</td>
                      <td className="py-2 pr-4">
                        <div>{order.fullName}</div>
                        <div className="text-xs text-[var(--color-muted)]">{order.email}</div>
                      </td>
                      <td className="py-2 pr-4">{car?.name ?? '—'}</td>
                      <td className="py-2 pr-4 text-xs">
                        {String(order.pickupDate).slice(0, 10)} → {String(order.returnDate).slice(0, 10)}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="rounded-md bg-[var(--color-accent-muted)] px-2 py-0.5 text-xs font-medium capitalize text-[var(--color-ink)]">{order.status}</span>
                      </td>
                      <td className="py-2 pr-4">{formatPrice(order.totalPrice)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          <Link to={`/admin/orders/${order.id}`}>
                            <Button size="sm" variant="ghost">View</Button>
                          </Link>
                          {tab === 'active' && (
                            <>
                              <Link to={`/admin/orders/${order.id}/edit`}>
                                <Button size="sm" variant="outline">Edit</Button>
                              </Link>
                              <Button size="sm" variant="danger" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(order.id); }}>Delete</Button>
                            </>
                          )}
                          {tab === 'deleted' && (
                            <Button size="sm" variant="outline" loading={restoreMutation.isPending} onClick={() => restoreMutation.mutate(order.id)}>Restore</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {orders?.length === 0 && <p className="py-8 text-center text-[var(--color-muted)]">No orders found</p>}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
