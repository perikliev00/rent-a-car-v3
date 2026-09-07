import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  complianceTypeHasExpiry,
  createCarCompliance,
  deleteCarCompliance,
  downloadCarComplianceDocument,
  getCarCompliance,
} from '../../../api/admin/cars';
import { toast } from '../../../components/ui/toastStore';
import type { ComplianceForm, Tab } from './carDetailTypes';
import { refreshCar } from './carDetailRefresh';

export function useCarCompliance(id: string, tab: Tab) {
  const queryClient = useQueryClient();
  const [complianceForm, setComplianceForm] = useState<ComplianceForm>({
    itemType: 'civil_insurance',
    title: '',
    referenceNumber: '',
    issuedAt: '',
    expiresAt: '',
    notes: '',
    status: '',
  });
  const [complianceFile, setComplianceFile] = useState<File | null>(null);

  const complianceQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'compliance'],
    queryFn: () => getCarCompliance(id),
    enabled: Boolean(id) && tab === 'compliance',
  });

  const complianceMutation = useMutation({
    mutationFn: () => {
      const hasExpiry = complianceTypeHasExpiry(complianceForm.itemType);
      const fd = new FormData();
      fd.append('itemType', complianceForm.itemType);
      if (complianceForm.title) fd.append('title', complianceForm.title);
      if (complianceForm.referenceNumber) {
        fd.append('referenceNumber', complianceForm.referenceNumber);
      }
      if (hasExpiry) {
        if (complianceForm.issuedAt) fd.append('issuedAt', complianceForm.issuedAt);
        if (complianceForm.expiresAt) fd.append('expiresAt', complianceForm.expiresAt);
      }
      if (complianceForm.notes) fd.append('notes', complianceForm.notes);
      if (complianceForm.status === 'missing') fd.append('status', 'missing');
      if (complianceFile) fd.append('file', complianceFile);
      return createCarCompliance(id, fd);
    },
    onSuccess: () => {
      toast('Compliance item added', 'success');
      setComplianceForm({
        itemType: 'civil_insurance',
        title: '',
        referenceNumber: '',
        issuedAt: '',
        expiresAt: '',
        notes: '',
        status: '',
      });
      setComplianceFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'compliance'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'fleet-alerts'] });
      refreshCar(queryClient, id);
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  async function downloadComplianceDocument(itemId: number, filename: string) {
    try {
      await downloadCarComplianceDocument(id, itemId, filename);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function deleteComplianceItem(itemId: number) {
    try {
      await deleteCarCompliance(id, itemId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'compliance'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'fleet-alerts'] });
      refreshCar(queryClient, id);
      toast('Deleted', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return {
    complianceQuery,
    complianceForm,
    setComplianceForm,
    complianceFile,
    setComplianceFile,
    complianceMutation,
    downloadComplianceDocument,
    deleteComplianceItem,
  };
}
