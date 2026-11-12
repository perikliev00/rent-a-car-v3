/**
 * Manual admin order creation with availability/pricing checks.
 */
import { useState } from 'react';
// Import named exports from 'react-router-dom'.
import { useNavigate } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery, useMutation } from '@tanstack/react-query';
// Import named exports from '../../api/admin/orders'.
import { getNewOrderForm, createAdminOrder } from '../../api/admin/orders';
// Import named exports from '../../api/locations'.
import { getLocations } from '../../api/locations';
// Import named exports from '../../components/ui/Input'.
import { Input } from '../../components/ui/Input';
// Import named exports from '../../components/ui/Select'.
import { Select } from '../../components/ui/Select';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/toastStore'.
import { toast } from '../../components/ui/toastStore';

/** Manual admin order creation with availability/pricing checks. */
export function AdminOrderCreatePage() {
  // Create the navigate constant.
  const navigate = useNavigate();
  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'orders', 'new'], queryFn: getNewOrderForm });
  // Destructure object properties into local variables.
  const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: getLocations });

  // Destructure array values into local variables.
  const [form, setForm] = useState<Record<string, string>>({});

  // Create the create mutation constant.
  const createMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
      // Call createAdminOrder to perform this step.
      createAdminOrder({
        // Provide the car id field value.
        carId: form.carId,
        // Provide the pickup date field value.
        pickupDate: form.pickupDate,
        // Provide the return date field value.
        returnDate: form.returnDate,
        // Provide the pickup time field value.
        pickupTime: form.pickupTime,
        // Provide the return time field value.
        returnTime: form.returnTime,
        // Provide the pickup location field value.
        pickupLocation: form.pickupLocation,
        // Provide the return location field value.
        returnLocation: form.returnLocation,
        // Provide the full name field value.
        fullName: form.fullName,
        // Provide the phone number field value.
        phoneNumber: form.phoneNumber,
        // Provide the email field value.
        email: form.email,
        // Provide the address field value.
        address: form.address,
        // Provide the hotel name field value.
        hotelName: form.hotelName,
      }),
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Order created', 'success');
      // Call navigate to perform this step.
      navigate('/admin/orders');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  if (isLoading || !data) return <PageLoader />;

  // Create the defaults constant.
  const defaults = data.defaults as Record<string, string>;
  // Create the values constant.
  const values = { ...defaults, ...form };
  // Create the location options constant.
  const locationOptions = locations?.locations.map((l) => ({ value: l.id, label: l.label })) ?? [];

  // Return control to the caller with the following value.
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
