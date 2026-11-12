/**
 * Service-record query/mutation hooks for a car.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCarServiceRecord,
  deleteCarServiceRecord,
  getCarServiceRecords,
} from '../../../api/admin/cars';
import { toast } from '../../../components/ui/toastStore';
import type { ServiceForm, Tab } from './carDetailTypes';

/**
 * Service-record list/create/delete for a car (active on the Service tab).
 * Empty optional form strings are omitted from the create payload.
 *
 * @param id - Car id
 * @param tab - Active detail tab
 */
export function useCarService(id: string, tab: Tab) {
  const queryClient = useQueryClient();
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    serviceType: 'oil_change',
    description: '',
    cost: '',
    mileage: '',
    serviceDate: '',
    nextServiceDate: '',
  });

  const serviceQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'service'],
    queryFn: () => getCarServiceRecords(id),
    enabled: Boolean(id) && tab === 'service',
  });

  const serviceMutation = useMutation({
    mutationFn: () =>
      createCarServiceRecord(id, {
        serviceType: serviceForm.serviceType,
        description: serviceForm.description || undefined,
        cost: serviceForm.cost || undefined,
        mileage: serviceForm.mileage || undefined,
        serviceDate: serviceForm.serviceDate,
        nextServiceDate: serviceForm.nextServiceDate || undefined,
      }),
    onSuccess: () => {
      toast('Service record added', 'success');
      setServiceForm({
        serviceType: 'oil_change',
        description: '',
        cost: '',
        mileage: '',
        serviceDate: '',
        nextServiceDate: '',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'service'] });
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  /** Delete a service record and refresh the service list. */
  async function deleteServiceRecord(recordId: number) {
    try {
      await deleteCarServiceRecord(id, recordId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'service'] });
      toast('Deleted', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return {
    serviceQuery,
    serviceForm,
    setServiceForm,
    serviceMutation,
    deleteServiceRecord,
  };
}
