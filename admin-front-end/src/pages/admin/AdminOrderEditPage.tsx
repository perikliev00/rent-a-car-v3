import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAdminOrderEdit, updateAdminOrder } from '../../api/admin/orders';
import { getLocations } from '../../api/locations';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { toast } from '../../components/ui/toastStore';
import { getCarIdString } from '../../types/api';

export function AdminOrderEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'order', id, 'edit'],
    queryFn: () => getAdminOrderEdit(id!),
    enabled: !!id,
  });
  const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: getLocations });

  const [form, setForm] = useState<Record<string, string>>({});

  const updateMutation = useMutation({
    mutationFn: () =>
      updateAdminOrder(id!, {
        carId: form.carId ?? getCarIdString(data!.order.carId),
        pickupDate: form.pickupDate ?? data!.pickupDateISO,
        returnDate: form.returnDate ?? data!.returnDateISO,
        pickupTime: form.pickupTime ?? data!.pickupTimeHHMM,
        returnTime: form.returnTime ?? data!.returnTimeHHMM,
        pickupLocation: form.pickupLocation ?? String(data!.order.pickupLocation),
        returnLocation: form.returnLocation ?? String(data!.order.returnLocation),
        fullName: form.fullName ?? data!.order.fullName,
        phoneNumber: form.phoneNumber ?? data!.order.phoneNumber,
        email: form.email ?? data!.order.email,
        address: form.address ?? data!.order.address,
        hotelName: form.hotelName ?? data!.order.hotelName ?? '',
      }),
    onSuccess: () => {
      toast('Order updated', 'success');
      navigate(`/admin/orders/${id}`);
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  if (isLoading || !data) return <PageLoader />;

  const order = data.order;
  const locationOptions = locations?.locations.map((l) => ({ value: l.id, label: l.label })) ?? [];

  return (
    <div className="mx-auto min-w-0 max-w-2xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">Edit order #{id}</h1>
      <Card className="mt-6">
        <CardBody>
          <form
            className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
          >
            <Select
              label="Car"
              value={form.carId ?? getCarIdString(order.carId)}
              onChange={(e) => setForm({ ...form, carId: e.target.value })}
              options={data.cars.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input label="Full name" defaultValue={order.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input label="Email" type="email" defaultValue={order.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" defaultValue={order.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
            <Input label="Pickup date" type="date" defaultValue={data.pickupDateISO} onChange={(e) => setForm({ ...form, pickupDate: e.target.value })} />
            <Input label="Return date" type="date" defaultValue={data.returnDateISO} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} />
            <Input label="Pickup time" type="time" defaultValue={data.pickupTimeHHMM} onChange={(e) => setForm({ ...form, pickupTime: e.target.value })} />
            <Input label="Return time" type="time" defaultValue={data.returnTimeHHMM} onChange={(e) => setForm({ ...form, returnTime: e.target.value })} />
            <Select label="Pickup location" defaultValue={String(order.pickupLocation)} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} options={locationOptions} />
            <Select label="Return location" defaultValue={String(order.returnLocation)} onChange={(e) => setForm({ ...form, returnLocation: e.target.value })} options={locationOptions} />
            <Input label="Address" className="sm:col-span-2" defaultValue={order.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={updateMutation.isPending}>Save</Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/admin/orders/${id}`)}>Cancel</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
