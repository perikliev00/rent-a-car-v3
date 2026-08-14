import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminOrders,
  getDeletedOrders,
  getExpiredOrders,
  deleteAdminOrder,
  restoreAdminOrder,
  emptyDeletedOrders,
} from '../../api/admin/orders';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { toast } from '../../components/ui/toastStore';
import { formatPrice } from '../../utils/format';
import { getCarFromOrder } from '../../types/api';
import type { OrderStatus } from '../../types/api';

type Tab = 'active' | 'expired' | 'deleted';

export function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('active');
  const [filters, setFilters] = useState({ status: '' as OrderStatus | '', startDate: '', endDate: '', search: '' });
  const [confirmEmpty, setConfirmEmpty] = useState('');

  const activeQuery = useQuery({
    queryKey: ['admin', 'orders', filters],
    queryFn: () => getAdminOrders(filters),
    enabled: tab === 'active',
  });

  const expiredQuery = useQuery({
    queryKey: ['admin', 'orders', 'expired'],
    queryFn: getExpiredOrders,
    enabled: tab === 'expired',
  });

  const deletedQuery = useQuery({
    queryKey: ['admin', 'orders', 'deleted'],
    queryFn: getDeletedOrders,
    enabled: tab === 'deleted',
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast('Order moved to bin', 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreAdminOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast('Order restored', 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const emptyMutation = useMutation({
    mutationFn: () => emptyDeletedOrders(confirmEmpty),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast(`Permanently deleted ${data.deletedCount} orders`, 'success');
      setConfirmEmpty('');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const isLoading = activeQuery.isLoading || expiredQuery.isLoading || deletedQuery.isLoading;
  const orders =
    tab === 'active' ? activeQuery.data?.orders :
    tab === 'expired' ? expiredQuery.data?.orders :
    deletedQuery.data?.orders;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Orders</h1>
          <p className="mt-1 text-[var(--color-muted)]">Manage bookings and reservations</p>
        </div>
        <Link to="/admin/orders/new">
          <Button>Create order</Button>
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
            <div className="grid gap-4 sm:grid-cols-4">
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
              <Input label="From" type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
              <Input label="To" type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
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
