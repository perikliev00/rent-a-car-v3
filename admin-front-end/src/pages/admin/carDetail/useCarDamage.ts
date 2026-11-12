/**
 * Damage-report query/mutation hooks for a car.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  createCarDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  deleteCarDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  getCarDamageReports,
  // Contribute this line to the enclosing declaration or statement.
  resolveCarDamageReport,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/cars';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Contribute this line to the enclosing declaration or statement.
import type { DamageForm, Tab } from './carDetailTypes';
// Import named exports from './carDetailRefresh'.
import { refreshCar } from './carDetailRefresh';

/**
 * Damage-report CRUD helpers for a car (active on the Damage tab).
 * Create uses multipart FormData so optional photos can be attached.
 *
 * @param id - Car id
 * @param tab - Active detail tab
 */
export function useCarDamage(id: string, tab: Tab) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [damageForm, setDamageForm] = useState<DamageForm>({
    // Provide the description field value.
    description: '',
    // Provide the reservation id field value.
    reservationId: '',
    // Provide the repair cost field value.
    repairCost: '',
  });
  // Destructure array values into local variables.
  const [damagePhotos, setDamagePhotos] = useState<FileList | null>(null);

  // Create the damage query constant.
  const damageQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'cars', id, 'damage'],
    // Provide the query fn field value.
    queryFn: () => getCarDamageReports(id),
    // Provide the enabled field value.
    enabled: Boolean(id) && tab === 'damage',
  });

  // Create the damage mutation constant.
  const damageMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () => {
      // Create the fd constant.
      const fd = new FormData();
      // Call fd.append to perform this step.
      fd.append('description', damageForm.description);
      // Evaluate the condition and enter the branch when it is true.
      if (damageForm.reservationId) fd.append('reservationId', damageForm.reservationId);
      // Evaluate the condition and enter the branch when it is true.
      if (damageForm.repairCost) fd.append('repairCost', damageForm.repairCost);
      // Multiple files share the `photos` field name expected by the API.
      if (damagePhotos) {
        // Call Array.from to perform this step.
        Array.from(damagePhotos).forEach((file) => fd.append('photos', file));
      }
      // Return the resulting value to the caller.
      return createCarDamageReport(id, fd);
    },
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Damage report created', 'success');
      // Call setDamageForm to perform this step.
      setDamageForm({ description: '', reservationId: '', repairCost: '' });
      // Call setDamagePhotos to perform this step.
      setDamagePhotos(null);
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'damage'] });
      // Call refreshCar to perform this step.
      refreshCar(queryClient, id);
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  /** Mark a damage report resolved and refresh the list. */
  async function resolveDamage(reportId: number) {
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await resolveCarDamageReport(id, reportId);
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'damage'] });
      // Call toast to perform this step.
      toast('Resolved', 'success');
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    }
  }

  /** Delete a damage report and refresh the list. */
  async function deleteDamage(reportId: number) {
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await deleteCarDamageReport(id, reportId);
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'damage'] });
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
    damageQuery,
    // Contribute this line to the enclosing declaration or statement.
    damageForm,
    // Contribute this line to the enclosing declaration or statement.
    setDamageForm,
    // Contribute this line to the enclosing declaration or statement.
    damagePhotos,
    // Contribute this line to the enclosing declaration or statement.
    setDamagePhotos,
    // Contribute this line to the enclosing declaration or statement.
    damageMutation,
    // Contribute this line to the enclosing declaration or statement.
    resolveDamage,
    // Contribute this line to the enclosing declaration or statement.
    deleteDamage,
  };
}
