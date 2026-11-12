/**
 * Fleet inventory list with create/edit entry points.
 */
import { useState } from 'react';
// Import named exports from 'react-router-dom'.
import { Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getAdminCars,
  // Contribute this line to the enclosing declaration or statement.
  createAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  updateAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  deleteAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  FUEL_LEVEL_OPTIONS,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/admin/cars';
// Import named exports from '../../api/locations'.
import { getCategories } from '../../api/locations';
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
import { formatPrice, imageUrl } from '../../utils/format';
// Contribute this line to the enclosing declaration or statement.
import type { Car, Transmission, FuelType, FuelLevel } from '../../types/api';

// Create the empty form constant.
const emptyForm = {
  // Provide the name field value.
  name: '',
  // Provide the transmission field value.
  transmission: 'Automatic' as Transmission,
  // Provide the fuel type field value.
  fuelType: 'Petrol' as FuelType,
  // Provide the seats field value.
  seats: '5',
  // Provide the category id field value.
  categoryId: '',
  // Provide the price tier 1 3 field value.
  priceTier_1_3: '',
  // Provide the price tier 7 31 field value.
  priceTier_7_31: '',
  // Provide the price tier 31 plus field value.
  priceTier_31_plus: '',
  // Provide the availability field value.
  availability: true,
  // Provide the registration number field value.
  registrationNumber: '',
  // Provide the vin field value.
  vin: '',
  // Provide the mileage field value.
  mileage: '',
  // Provide the fuel level field value.
  fuelLevel: '' as FuelLevel | '',
  // Provide the current location field value.
  currentLocation: '',
  // Provide the insurance expiry field value.
  insuranceExpiry: '',
  // Provide the technical inspection expiry field value.
  technicalInspectionExpiry: '',
};

/** Is Overdue. */
function isOverdue(dateStr?: string) {
  // Evaluate the condition and enter the branch when it is true.
  if (!dateStr) return false;
  // Create the d constant.
  const d = new Date(dateStr);
  // Evaluate the condition and enter the branch when it is true.
  if (Number.isNaN(d.getTime())) return false;
  // Create the today constant.
  const today = new Date();
  // Call today.setHours to perform this step.
  today.setHours(0, 0, 0, 0);
  // Return the resulting value to the caller.
  return d < today;
}

/** Status Chip Class. */
function statusChipClass(status?: string) {
  // Create the s constant.
  const s = (status || 'available').toLowerCase();
  // Evaluate the condition and enter the branch when it is true.
  if (s === 'available') return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  // Evaluate the condition and enter the branch when it is true.
  if (s === 'reserved' || s === 'rented') return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  // Evaluate the condition and enter the branch when it is true.
  if (s.includes('needs') || s === 'in_maintenance' || s === 'damaged' || s === 'inactive') {
    // Return the resulting value to the caller.
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  // Return the resulting value to the caller.
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

/** Fleet inventory list with create/edit entry points. */
export function AdminCarsPage() {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [editing, setEditing] = useState<Car | null>(null);
  // Destructure array values into local variables.
  const [showForm, setShowForm] = useState(false);
  // Destructure array values into local variables.
  const [form, setForm] = useState(emptyForm);
  // Destructure array values into local variables.
  const [image, setImage] = useState<File | null>(null);

  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'cars'],
    // Provide the query fn field value.
    queryFn: getAdminCars,
  });

  // Destructure object properties into local variables.
  const { data: categoriesData } = useQuery({
    // Provide the query key field value.
    queryKey: ['categories'],
    // Provide the query fn field value.
    queryFn: getCategories,
  });

  // Create the save mutation constant.
  const saveMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: async () => {
      // Create the fd constant.
      const fd = new FormData();
      // Evaluate the condition and enter the branch when it is true.
      if (image) fd.append('image', image);
      // Call fd.append to perform this step.
      fd.append('name', form.name);
      // Call fd.append to perform this step.
      fd.append('transmission', form.transmission);
      // Call fd.append to perform this step.
      fd.append('fuelType', form.fuelType);
      // Call fd.append to perform this step.
      fd.append('seats', form.seats);
      // Call fd.append to perform this step.
      fd.append('categoryId', form.categoryId);
      // Call fd.append to perform this step.
      fd.append('priceTier_1_3', form.priceTier_1_3);
      // Evaluate the condition and enter the branch when it is true.
      if (form.priceTier_7_31) fd.append('priceTier_7_31', form.priceTier_7_31);
      // Evaluate the condition and enter the branch when it is true.
      if (form.priceTier_31_plus) fd.append('priceTier_31_plus', form.priceTier_31_plus);
      // Evaluate the condition and enter the branch when it is true.
      if (form.availability) fd.append('availability', 'on');
      // Evaluate the condition and enter the branch when it is true.
      if (form.registrationNumber) fd.append('registrationNumber', form.registrationNumber);
      // Evaluate the condition and enter the branch when it is true.
      if (form.vin) fd.append('vin', form.vin);
      // Evaluate the condition and enter the branch when it is true.
      if (form.mileage) fd.append('mileage', form.mileage);
      // Evaluate the condition and enter the branch when it is true.
      if (form.fuelLevel) fd.append('fuelLevel', form.fuelLevel);
      // Evaluate the condition and enter the branch when it is true.
      if (form.currentLocation) fd.append('currentLocation', form.currentLocation);
      // Evaluate the condition and enter the branch when it is true.
      if (form.insuranceExpiry) fd.append('insuranceExpiry', form.insuranceExpiry);
      // Evaluate the condition and enter the branch when it is true.
      if (form.technicalInspectionExpiry) {
        // Call fd.append to perform this step.
        fd.append('technicalInspectionExpiry', form.technicalInspectionExpiry);
      }

      // Evaluate the condition and enter the branch when it is true.
      if (editing) {
        // Return the resulting value to the caller.
        return updateAdminCar(editing.id, fd);
      }
      // Return the resulting value to the caller.
      return createAdminCar(fd);
    },
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars'] });
      // Call toast to perform this step.
      toast('Car saved', 'success');
      // Call resetForm to perform this step.
      resetForm();
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the delete mutation constant.
  const deleteMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: (id: string) => deleteAdminCar(id),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars'] });
      // Call toast to perform this step.
      toast('Car deleted', 'success');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the reset form constant.
  const resetForm = () => {
    // Call setForm to perform this step.
    setForm(emptyForm);
    // Call setImage to perform this step.
    setImage(null);
    // Call setEditing to perform this step.
    setEditing(null);
    // Call setShowForm to perform this step.
    setShowForm(false);
  };

  // Create the start edit constant.
  const startEdit = (car: Car) => {
    // Call setEditing to perform this step.
    setEditing(car);
    // Call setForm to perform this step.
    setForm({
      // Provide the name field value.
      name: car.name,
      // Provide the transmission field value.
      transmission: car.transmission as Transmission,
      // Provide the fuel type field value.
      fuelType: car.fuelType as FuelType,
      // Provide the seats field value.
      seats: String(car.seats),
      // Provide the category id field value.
      categoryId: car.categoryId ? String(car.categoryId) : '',
      // Provide the price tier 1 3 field value.
      priceTier_1_3: String(car.priceTier_1_3 ?? ''),
      // Provide the price tier 7 31 field value.
      priceTier_7_31: String(car.priceTier_7_31 ?? ''),
      // Provide the price tier 31 plus field value.
      priceTier_31_plus: String(car.priceTier_31_plus ?? ''),
      // Provide the availability field value.
      availability: car.availability,
      // Provide the registration number field value.
      registrationNumber: car.registrationNumber ?? '',
      // Provide the vin field value.
      vin: car.vin ?? '',
      // Provide the mileage field value.
      mileage: car.mileage != null ? String(car.mileage) : '',
      // Provide the fuel level field value.
      fuelLevel: car.fuelLevel ?? '',
      // Provide the current location field value.
      currentLocation: car.currentLocation ?? '',
      // Provide the insurance expiry field value.
      insuranceExpiry: car.insuranceExpiry ?? '',
      // Provide the technical inspection expiry field value.
      technicalInspectionExpiry: car.technicalInspectionExpiry ?? '',
    });
    // Call setShowForm to perform this step.
    setShowForm(true);
  };

  if (isLoading) return <PageLoader />;

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">Cars</h1>
          <p className="mt-1 text-[var(--color-muted)]">Manage your fleet</p>
        </div>
        <Button className="shrink-0" onClick={() => { resetForm(); setShowForm(true); }}>
          Add car
        </Button>
      </div>

      {showForm && (
        <Card className="mt-6">
          <CardBody>
            <h2 className="font-semibold">{editing ? 'Edit car' : 'New car'}</h2>
            <form
              className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
            >
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)]">Image {!editing && '(required)'}</label>
                <input type="file" accept="image/*" className="mt-1 text-sm" onChange={(e) => setImage(e.target.files?.[0] ?? null)} required={!editing} />
              </div>
              <Select label="Transmission" value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value as Transmission })} options={[{ value: 'Automatic', label: 'Automatic' }, { value: 'Manual', label: 'Manual' }]} />
              <Select label="Fuel type" value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value as FuelType })} options={['Petrol', 'Diesel', 'Hybrid', 'Electric'].map((v) => ({ value: v, label: v }))} />
              <Select
                label="Category"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                options={[
                  { value: '', label: 'None' },
                  ...(categoriesData?.categories ?? []).map((c) => ({
                    value: String(c.id),
                    label: c.name,
                  })),
                ]}
              />
              <Input label="Seats" type="number" min={2} max={9} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} required />
              <Input label="Price tier 1–3 days" type="number" step="0.01" value={form.priceTier_1_3} onChange={(e) => setForm({ ...form, priceTier_1_3: e.target.value })} required />
              <Input label="Price tier 7–31 days" type="number" step="0.01" value={form.priceTier_7_31} onChange={(e) => setForm({ ...form, priceTier_7_31: e.target.value })} />
              <Input label="Price tier 31+ days" type="number" step="0.01" value={form.priceTier_31_plus} onChange={(e) => setForm({ ...form, priceTier_31_plus: e.target.value })} />
              <Input label="Registration number" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
              <Input label="VIN" value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
              <Input label="Mileage" type="number" min={0} value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
              <Select
                label="Fuel level"
                value={form.fuelLevel}
                onChange={(e) => setForm({ ...form, fuelLevel: e.target.value as FuelLevel | '' })}
                options={FUEL_LEVEL_OPTIONS}
              />
              <Input label="Current location" value={form.currentLocation} onChange={(e) => setForm({ ...form, currentLocation: e.target.value })} />
              <Input label="Insurance expiry" type="date" value={form.insuranceExpiry} onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })} />
              <Input label="Technical inspection expiry" type="date" value={form.technicalInspectionExpiry} onChange={(e) => setForm({ ...form, technicalInspectionExpiry: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.checked })} />
                Available for booking
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" loading={saveMutation.isPending}>Save</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <div className="mt-8 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.cars.map((car) => {
          const insuranceOverdue = isOverdue(car.insuranceExpiry);
          const inspectionOverdue = isOverdue(car.technicalInspectionExpiry);
          return (
            <Card key={car.id} className="overflow-hidden">
              <img src={imageUrl(car.image)} alt={car.name} className="aspect-video w-full object-cover" />
              <CardBody>
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <h3 className="min-w-0 break-words font-semibold">{car.name}</h3>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusChipClass(car.status)}`}>
                    {car.status || 'available'}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-muted)]">
                  {car.transmission} · {car.fuelType} · {car.seats} seats
                  {car.category ? ` · ${car.category}` : ''}
                </p>
                {car.mileage != null ? (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{car.mileage.toLocaleString()} km</p>
                ) : null}
                {(insuranceOverdue || inspectionOverdue) && (
                  <p className="mt-1 text-xs font-medium text-[var(--color-danger)]">
                    {insuranceOverdue ? 'Insurance overdue' : ''}
                    {insuranceOverdue && inspectionOverdue ? ' · ' : ''}
                    {inspectionOverdue ? 'Inspection overdue' : ''}
                  </p>
                )}
                <p className="mt-1 font-medium text-[var(--color-accent-ink)]">{formatPrice(car.priceTier_1_3 ?? 0)}/day</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/admin/cars/${car.id}`}>
                    <Button size="sm">Open</Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => startEdit(car)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm('Delete this car?')) deleteMutation.mutate(car.id); }}>Delete</Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
