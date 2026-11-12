/**
 * Service-record query/mutation hooks for a car.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  createCarServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  deleteCarServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  getCarServiceRecords,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/cars';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Contribute this line to the enclosing declaration or statement.
import type { ServiceForm, Tab } from './carDetailTypes';

/**
 * Service-record list/create/delete for a car (active on the Service tab).
 * Empty optional form strings are omitted from the create payload.
 *
 * @param id - Car id
 * @param tab - Active detail tab
 */
export function useCarService(id: string, tab: Tab) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    // Provide the service type field value.
    serviceType: 'oil_change',
    // Provide the description field value.
    description: '',
    // Provide the cost field value.
    cost: '',
    // Provide the mileage field value.
    mileage: '',
    // Provide the service date field value.
    serviceDate: '',
    // Provide the next service date field value.
    nextServiceDate: '',
  });

  // Create the service query constant.
  const serviceQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'cars', id, 'service'],
    // Provide the query fn field value.
    queryFn: () => getCarServiceRecords(id),
    // Provide the enabled field value.
    enabled: Boolean(id) && tab === 'service',
  });

  // Create the service mutation constant.
  const serviceMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
      // Call createCarServiceRecord to perform this step.
      createCarServiceRecord(id, {
        // Provide the service type field value.
        serviceType: serviceForm.serviceType,
        // Provide the description field value.
        description: serviceForm.description || undefined,
        // Provide the cost field value.
        cost: serviceForm.cost || undefined,
        // Provide the mileage field value.
        mileage: serviceForm.mileage || undefined,
        // Provide the service date field value.
        serviceDate: serviceForm.serviceDate,
        // Provide the next service date field value.
        nextServiceDate: serviceForm.nextServiceDate || undefined,
      }),
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Service record added', 'success');
      // Call setServiceForm to perform this step.
      setServiceForm({
        // Provide the service type field value.
        serviceType: 'oil_change',
        // Provide the description field value.
        description: '',
        // Provide the cost field value.
        cost: '',
        // Provide the mileage field value.
        mileage: '',
        // Provide the service date field value.
        serviceDate: '',
        // Provide the next service date field value.
        nextServiceDate: '',
      });
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'service'] });
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  /** Delete a service record and refresh the service list. */
  async function deleteServiceRecord(recordId: number) {
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await deleteCarServiceRecord(id, recordId);
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'service'] });
      // Call toast to perform this step.
      toast('Deleted', 'success');
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    }
  }

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    serviceQuery,
    // Contribute this line to the enclosing declaration or statement.
    serviceForm,
    // Contribute this line to the enclosing declaration or statement.
    setServiceForm,
    // Contribute this line to the enclosing declaration or statement.
    serviceMutation,
    // Contribute this line to the enclosing declaration or statement.
    deleteServiceRecord,
  };
}
