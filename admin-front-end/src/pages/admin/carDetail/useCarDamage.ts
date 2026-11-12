/**
 * Damage-report query/mutation hooks for a car.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCarDamageReport,
  deleteCarDamageReport,
  getCarDamageReports,
  resolveCarDamageReport,
} from '../../../api/admin/cars';
import { toast } from '../../../components/ui/toastStore';
import type { DamageForm, Tab } from './carDetailTypes';
import { refreshCar } from './carDetailRefresh';

/**
 * Damage-report CRUD helpers for a car (active on the Damage tab).
 * Create uses multipart FormData so optional photos can be attached.
 *
 * @param id - Car id
 * @param tab - Active detail tab
 */
export function useCarDamage(id: string, tab: Tab) {
  const queryClient = useQueryClient();
  const [damageForm, setDamageForm] = useState<DamageForm>({
    description: '',
    reservationId: '',
    repairCost: '',
  });
  const [damagePhotos, setDamagePhotos] = useState<FileList | null>(null);

  const damageQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'damage'],
    queryFn: () => getCarDamageReports(id),
    enabled: Boolean(id) && tab === 'damage',
  });

  const damageMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('description', damageForm.description);
      if (damageForm.reservationId) fd.append('reservationId', damageForm.reservationId);
      if (damageForm.repairCost) fd.append('repairCost', damageForm.repairCost);
      // Multiple files share the `photos` field name expected by the API.
      if (damagePhotos) {
        Array.from(damagePhotos).forEach((file) => fd.append('photos', file));
      }
      return createCarDamageReport(id, fd);
    },
    onSuccess: () => {
      toast('Damage report created', 'success');
      setDamageForm({ description: '', reservationId: '', repairCost: '' });
      setDamagePhotos(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'damage'] });
      refreshCar(queryClient, id);
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  /** Mark a damage report resolved and refresh the list. */
  async function resolveDamage(reportId: number) {
    try {
      await resolveCarDamageReport(id, reportId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'damage'] });
      toast('Resolved', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  /** Delete a damage report and refresh the list. */
  async function deleteDamage(reportId: number) {
    try {
      await deleteCarDamageReport(id, reportId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'damage'] });
      toast('Deleted', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return {
    damageQuery,
    damageForm,
    setDamageForm,
    damagePhotos,
    setDamagePhotos,
    damageMutation,
    resolveDamage,
    deleteDamage,
  };
}
