import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getNewOrderForm, createAdminOrder } from '../../api/admin/orders';
import { getLocations } from '../../api/locations';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { toast } from '../../components/ui/toastStore';

export function AdminOrderCreatePage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'orders', 'new'], queryFn: getNewOrderForm });
  const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: getLocations });

  const [form, setForm] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: () =>
      createAdminOrder({
        carId: form.carId,
        pickupDate: form.pickupDate,
        returnDate: form.returnDate,
        pickupTime: form.pickupTime,
        returnTime: form.returnTime,
        pickupLocation: form.pickupLocation,
        returnLocation: form.returnLocation,
        fullName: form.fullName,
        phoneNumber: form.phoneNumber,
        email: form.email,
        address: form.address,
        hotelName: form.hotelName,
      }),
    onSuccess: () => {
      toast('Order created', 'success');
      navigate('/admin/orders');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  if (isLoading || !data) return <PageLoader />;

  const defaults = data.defaults as Record<string, string>;
  const values = { ...defaults, ...form };
  const locationOptions = locations?.locations.map((l) => ({ value: l.id, label: l.label })) ?? [];

  return (
    <div className="mx-auto min-w-0 max-w-2xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">Create order</h1>
      <Card className="mt-6">
        <CardBody>
          <form
            className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setForm(values);
              createMutation.mutate();
            }}
          >
            <Select
              label="Car"
              value={values.carId ?? ''}
              onChange={(e) => setForm({ ...form, carId: e.target.value })}
              options={data.cars.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input label="Full name" value={values.fullName ?? ''} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            <Input label="Email" type="email" value={values.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <Input label="Phone" value={values.phoneNumber ?? ''} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} required />
            <Input label="Pickup date" type="date" value={values.pickupDate ?? ''} onChange={(e) => setForm({ ...form, pickupDate: e.target.value })} required />
            <Input label="Return date" type="date" value={values.returnDate ?? ''} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} required />
            <Input label="Pickup time" type="time" value={values.pickupTime ?? ''} onChange={(e) => setForm({ ...form, pickupTime: e.target.value })} />
            <Input label="Return time" type="time" value={values.returnTime ?? ''} onChange={(e) => setForm({ ...form, returnTime: e.target.value })} />
            <Select label="Pickup location" value={values.pickupLocation ?? 'office'} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} options={locationOptions} />
            <Select label="Return location" value={values.returnLocation ?? 'office'} onChange={(e) => setForm({ ...form, returnLocation: e.target.value })} options={locationOptions} />
            <Input label="Address" className="sm:col-span-2" value={values.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            <Input label="Hotel" className="sm:col-span-2" value={values.hotelName ?? ''} onChange={(e) => setForm({ ...form, hotelName: e.target.value })} />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={createMutation.isPending}>Create</Button>
              <Button type="button" variant="outline" onClick={() => navigate('/admin/orders')}>Cancel</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
