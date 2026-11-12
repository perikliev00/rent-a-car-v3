/**
 * Form state and save handlers for the car overview tab.
 */
import { useEffect, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  changeCarFleetStatus,
  // Contribute this line to the enclosing declaration or statement.
  getAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  updateAdminCar,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/cars';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Contribute this line to the enclosing declaration or statement.
import type { CarFleetStatus } from '../../../types/api';
// Contribute this line to the enclosing declaration or statement.
import type { OverviewForm } from './carDetailTypes';
// Import named exports from './carDetailRefresh'.
import { refreshCar } from './carDetailRefresh';

/**
 * Form state, car query, and save/status mutations for the Overview tab.
 * @param id - Car id
 */
export function useCarOverview(id: string) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [fleetStatus, setFleetStatus] = useState<CarFleetStatus | ''>('');
  // Destructure array values into local variables.
  const [overviewForm, setOverviewForm] = useState<OverviewForm>({
    // Provide the registration number field value.
    registrationNumber: '',
    // Provide the vin field value.
    vin: '',
    // Provide the mileage field value.
    mileage: '',
    // Provide the fuel level field value.
    fuelLevel: '',
    // Provide the current location field value.
    currentLocation: '',
    // Provide the insurance expiry field value.
    insuranceExpiry: '',
    // Provide the technical inspection expiry field value.
    technicalInspectionExpiry: '',
  });

  // Create the car query constant.
  const carQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'cars', id],
    // Provide the query fn field value.
    queryFn: () => getAdminCar(id),
    // Provide the enabled field value.
    enabled: Boolean(id),
  });

  // Create the car constant.
  const car = carQuery.data?.car;

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!car) return;
    // Call setOverviewForm to perform this step.
    setOverviewForm({
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
  // Continue the surrounding logic with this statement.
  }, [car]);

  // Create the status mutation constant.
  const statusMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
      // Call changeCarFleetStatus to perform this step.
      changeCarFleetStatus(id, { status: fleetStatus as CarFleetStatus, reason: 'admin_fleet_detail' }),
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Status updated', 'success');
      // Call setFleetStatus to perform this step.
      setFleetStatus('');
      // Call refreshCar to perform this step.
      refreshCar(queryClient, id);
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the overview mutation constant.
  const overviewMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (!car) throw new Error('Car not found');
      // Create the fd constant.
      const fd = new FormData();
      // Call fd.append to perform this step.
      fd.append('name', car.name);
      // Call fd.append to perform this step.
      fd.append('transmission', car.transmission);
      // Call fd.append to perform this step.
      fd.append('fuelType', car.fuelType);
      // Call fd.append to perform this step.
      fd.append('seats', String(car.seats));
      // Evaluate the condition and enter the branch when it is true.
      if (car.categoryId) fd.append('categoryId', String(car.categoryId));
      // Call fd.append to perform this step.
      fd.append('priceTier_1_3', String(car.priceTier_1_3 ?? car.price ?? 0));
      // Evaluate the condition and enter the branch when it is true.
      if (car.priceTier_7_31 != null) fd.append('priceTier_7_31', String(car.priceTier_7_31));
      // Evaluate the condition and enter the branch when it is true.
      if (car.priceTier_31_plus != null) fd.append('priceTier_31_plus', String(car.priceTier_31_plus));
      // Evaluate the condition and enter the branch when it is true.
      if (car.status === 'available' || car.availability) fd.append('availability', 'on');
      // Evaluate the condition and enter the branch when it is true.
      if (car.status) fd.append('status', car.status);
      // Call fd.append to perform this step.
      fd.append('registrationNumber', overviewForm.registrationNumber);
      // Call fd.append to perform this step.
      fd.append('vin', overviewForm.vin);
      // Call fd.append to perform this step.
      fd.append('mileage', overviewForm.mileage);
      // Call fd.append to perform this step.
      fd.append('fuelLevel', overviewForm.fuelLevel);
      // Call fd.append to perform this step.
      fd.append('currentLocation', overviewForm.currentLocation);
      // Call fd.append to perform this step.
      fd.append('insuranceExpiry', overviewForm.insuranceExpiry);
      // Call fd.append to perform this step.
      fd.append('technicalInspectionExpiry', overviewForm.technicalInspectionExpiry);
      // Return the resulting value to the caller.
      return updateAdminCar(id, fd);
    },
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Fleet details saved', 'success');
      // Call refreshCar to perform this step.
      refreshCar(queryClient, id);
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    car,
    // Contribute this line to the enclosing declaration or statement.
    carQuery,
    // Contribute this line to the enclosing declaration or statement.
    fleetStatus,
    // Contribute this line to the enclosing declaration or statement.
    setFleetStatus,
    // Contribute this line to the enclosing declaration or statement.
    overviewForm,
    // Contribute this line to the enclosing declaration or statement.
    setOverviewForm,
    // Contribute this line to the enclosing declaration or statement.
    statusMutation,
    // Contribute this line to the enclosing declaration or statement.
    overviewMutation,
  };
}
