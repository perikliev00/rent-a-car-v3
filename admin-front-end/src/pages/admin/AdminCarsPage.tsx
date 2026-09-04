import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminCars,
  createAdminCar,
  updateAdminCar,
  deleteAdminCar,
  FUEL_LEVEL_OPTIONS,
} from '../../api/admin/cars';
import { getCategories } from '../../api/locations';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { toast } from '../../components/ui/toastStore';
import { formatPrice, imageUrl } from '../../utils/format';
import type { Car, Transmission, FuelType, FuelLevel } from '../../types/api';

const emptyForm = {
  name: '',
  transmission: 'Automatic' as Transmission,
  fuelType: 'Petrol' as FuelType,
  seats: '5',
  categoryId: '',
  priceTier_1_3: '',
  priceTier_7_31: '',
  priceTier_31_plus: '',
  availability: true,
  registrationNumber: '',
  vin: '',
  mileage: '',
  fuelLevel: '' as FuelLevel | '',
  currentLocation: '',
  insuranceExpiry: '',
  technicalInspectionExpiry: '',
};

function isOverdue(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function statusChipClass(status?: string) {
  const s = (status || 'available').toLowerCase();
  if (s === 'available') return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  if (s === 'reserved' || s === 'rented') return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  if (s.includes('needs') || s === 'in_maintenance' || s === 'damaged' || s === 'inactive') {
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

export function AdminCarsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Car | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'cars'],
    queryFn: getAdminCars,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      if (image) fd.append('image', image);
      fd.append('name', form.name);
      fd.append('transmission', form.transmission);
      fd.append('fuelType', form.fuelType);
      fd.append('seats', form.seats);
      fd.append('categoryId', form.categoryId);
      fd.append('priceTier_1_3', form.priceTier_1_3);
      if (form.priceTier_7_31) fd.append('priceTier_7_31', form.priceTier_7_31);
      if (form.priceTier_31_plus) fd.append('priceTier_31_plus', form.priceTier_31_plus);
      if (form.availability) fd.append('availability', 'on');
      if (form.registrationNumber) fd.append('registrationNumber', form.registrationNumber);
      if (form.vin) fd.append('vin', form.vin);
      if (form.mileage) fd.append('mileage', form.mileage);
      if (form.fuelLevel) fd.append('fuelLevel', form.fuelLevel);
      if (form.currentLocation) fd.append('currentLocation', form.currentLocation);
      if (form.insuranceExpiry) fd.append('insuranceExpiry', form.insuranceExpiry);
      if (form.technicalInspectionExpiry) {
        fd.append('technicalInspectionExpiry', form.technicalInspectionExpiry);
      }

      if (editing) {
        return updateAdminCar(editing.id, fd);
      }
      return createAdminCar(fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars'] });
      toast('Car saved', 'success');
      resetForm();
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminCar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars'] });
      toast('Car deleted', 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setImage(null);
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (car: Car) => {
    setEditing(car);
    setForm({
      name: car.name,
      transmission: car.transmission as Transmission,
      fuelType: car.fuelType as FuelType,
      seats: String(car.seats),
      categoryId: car.categoryId ? String(car.categoryId) : '',
      priceTier_1_3: String(car.priceTier_1_3 ?? ''),
      priceTier_7_31: String(car.priceTier_7_31 ?? ''),
      priceTier_31_plus: String(car.priceTier_31_plus ?? ''),
      availability: car.availability,
      registrationNumber: car.registrationNumber ?? '',
      vin: car.vin ?? '',
      mileage: car.mileage != null ? String(car.mileage) : '',
      fuelLevel: car.fuelLevel ?? '',
      currentLocation: car.currentLocation ?? '',
      insuranceExpiry: car.insuranceExpiry ?? '',
      technicalInspectionExpiry: car.technicalInspectionExpiry ?? '',
    });
    setShowForm(true);
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Cars</h1>
          <p className="mt-1 text-[var(--color-muted)]">Manage your fleet</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          Add car
        </Button>
      </div>

      {showForm && (
        <Card className="mt-6">
          <CardBody>
            <h2 className="font-semibold">{editing ? 'Edit car' : 'New car'}</h2>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.cars.map((car) => {
          const insuranceOverdue = isOverdue(car.insuranceExpiry);
          const inspectionOverdue = isOverdue(car.technicalInspectionExpiry);
          return (
            <Card key={car.id} className="overflow-hidden">
              <img src={imageUrl(car.image)} alt={car.name} className="aspect-video w-full object-cover" />
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold">{car.name}</h3>
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
