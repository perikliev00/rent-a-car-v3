import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeCarFleetStatus,
  getAdminCar,
  updateAdminCar,
} from '../../../api/admin/cars';
import { toast } from '../../../components/ui/toastStore';
import type { CarFleetStatus } from '../../../types/api';
import type { OverviewForm } from './carDetailTypes';
import { refreshCar } from './carDetailRefresh';

export function useCarOverview(id: string) {
  const queryClient = useQueryClient();
  const [fleetStatus, setFleetStatus] = useState<CarFleetStatus | ''>('');
  const [overviewForm, setOverviewForm] = useState<OverviewForm>({
    registrationNumber: '',
    vin: '',
    mileage: '',
    fuelLevel: '',
    currentLocation: '',
    insuranceExpiry: '',
    technicalInspectionExpiry: '',
  });

  const carQuery = useQuery({
    queryKey: ['admin', 'cars', id],
    queryFn: () => getAdminCar(id),
    enabled: Boolean(id),
  });

  const car = carQuery.data?.car;

  useEffect(() => {
    if (!car) return;
    setOverviewForm({
      registrationNumber: car.registrationNumber ?? '',
      vin: car.vin ?? '',
      mileage: car.mileage != null ? String(car.mileage) : '',
      fuelLevel: car.fuelLevel ?? '',
      currentLocation: car.currentLocation ?? '',
      insuranceExpiry: car.insuranceExpiry ?? '',
      technicalInspectionExpiry: car.technicalInspectionExpiry ?? '',
    });
  }, [car]);

  const statusMutation = useMutation({
    mutationFn: () =>
      changeCarFleetStatus(id, { status: fleetStatus as CarFleetStatus, reason: 'admin_fleet_detail' }),
    onSuccess: () => {
      toast('Status updated', 'success');
      setFleetStatus('');
      refreshCar(queryClient, id);
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const overviewMutation = useMutation({
    mutationFn: async () => {
      if (!car) throw new Error('Car not found');
      const fd = new FormData();
      fd.append('name', car.name);
      fd.append('transmission', car.transmission);
      fd.append('fuelType', car.fuelType);
      fd.append('seats', String(car.seats));
      if (car.categoryId) fd.append('categoryId', String(car.categoryId));
      fd.append('priceTier_1_3', String(car.priceTier_1_3 ?? car.price ?? 0));
      if (car.priceTier_7_31 != null) fd.append('priceTier_7_31', String(car.priceTier_7_31));
      if (car.priceTier_31_plus != null) fd.append('priceTier_31_plus', String(car.priceTier_31_plus));
      if (car.status === 'available' || car.availability) fd.append('availability', 'on');
      if (car.status) fd.append('status', car.status);
      fd.append('registrationNumber', overviewForm.registrationNumber);
      fd.append('vin', overviewForm.vin);
      fd.append('mileage', overviewForm.mileage);
      fd.append('fuelLevel', overviewForm.fuelLevel);
      fd.append('currentLocation', overviewForm.currentLocation);
      fd.append('insuranceExpiry', overviewForm.insuranceExpiry);
      fd.append('technicalInspectionExpiry', overviewForm.technicalInspectionExpiry);
      return updateAdminCar(id, fd);
    },
    onSuccess: () => {
      toast('Fleet details saved', 'success');
      refreshCar(queryClient, id);
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  return {
    car,
    carQuery,
    fleetStatus,
    setFleetStatus,
    overviewForm,
    setOverviewForm,
    statusMutation,
    overviewMutation,
  };
}
