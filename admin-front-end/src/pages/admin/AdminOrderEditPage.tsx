/**
 * Edit an existing admin order (dates, car, customer, locations).
 */
import { useState } from 'react';
// Import named exports from 'react-router-dom'.
import { useParams, useNavigate } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery, useMutation } from '@tanstack/react-query';
// Import named exports from '../../api/admin/orders'.
import { getAdminOrderEdit, updateAdminOrder } from '../../api/admin/orders';
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
// Import named exports from '../../types/api'.
import { getCarIdString } from '../../types/api';

/** Edit an existing admin order (dates, car, customer, locations). */
export function AdminOrderEditPage() {
  // Destructure object properties into local variables.
  const { id } = useParams<{ id: string }>();
  // Create the navigate constant.
  const navigate = useNavigate();
  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'order', id, 'edit'],
    // Provide the query fn field value.
    queryFn: () => getAdminOrderEdit(id!),
    // Provide the enabled field value.
    enabled: !!id,
  });
  // Destructure object properties into local variables.
  const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: getLocations });

  // Destructure array values into local variables.
  const [form, setForm] = useState<Record<string, string>>({});

  // Create the update mutation constant.
  const updateMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
      // Call updateAdminOrder to perform this step.
      updateAdminOrder(id!, {
        // Provide the car id field value.
        carId: form.carId ?? getCarIdString(data!.order.carId),
        // Provide the pickup date field value.
        pickupDate: form.pickupDate ?? data!.pickupDateISO,
        // Provide the return date field value.
        returnDate: form.returnDate ?? data!.returnDateISO,
        // Provide the pickup time field value.
        pickupTime: form.pickupTime ?? data!.pickupTimeHHMM,
        // Provide the return time field value.
        returnTime: form.returnTime ?? data!.returnTimeHHMM,
        // Provide the pickup location field value.
        pickupLocation: form.pickupLocation ?? String(data!.order.pickupLocation),
        // Provide the return location field value.
        returnLocation: form.returnLocation ?? String(data!.order.returnLocation),
        // Provide the full name field value.
        fullName: form.fullName ?? data!.order.fullName,
        // Provide the phone number field value.
        phoneNumber: form.phoneNumber ?? data!.order.phoneNumber,
        // Provide the email field value.
        email: form.email ?? data!.order.email,
        // Provide the address field value.
        address: form.address ?? data!.order.address,
        // Provide the hotel name field value.
        hotelName: form.hotelName ?? data!.order.hotelName ?? '',
      }),
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Order updated', 'success');
      // Call navigate to perform this step.
      navigate(`/admin/orders/${id}`);
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  if (isLoading || !data) return <PageLoader />;

  // Create the order constant.
  const order = data.order;
  // Create the location options constant.
  const locationOptions = locations?.locations.map((l) => ({ value: l.id, label: l.label })) ?? [];

  // Return control to the caller with the following value.
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
