/**
 * Compliance query/mutation hooks including expiry-aware forms.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  complianceTypeHasExpiry,
  // Contribute this line to the enclosing declaration or statement.
  createCarCompliance,
  // Contribute this line to the enclosing declaration or statement.
  deleteCarCompliance,
  // Contribute this line to the enclosing declaration or statement.
  downloadCarComplianceDocument,
  // Contribute this line to the enclosing declaration or statement.
  getCarCompliance,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/cars';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Contribute this line to the enclosing declaration or statement.
import type { ComplianceForm, Tab } from './carDetailTypes';
// Import named exports from './carDetailRefresh'.
import { refreshCar } from './carDetailRefresh';

/**
 * Compliance list/create/delete/download for a car (active on the Compliance tab).
 * Create builds multipart FormData and omits date fields when the type has no expiry.
 *
 * @param id - Car id
 * @param tab - Active detail tab
 */
export function useCarCompliance(id: string, tab: Tab) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [complianceForm, setComplianceForm] = useState<ComplianceForm>({
    // Provide the item type field value.
    itemType: 'civil_insurance',
    // Provide the title field value.
    title: '',
    // Provide the reference number field value.
    referenceNumber: '',
    // Provide the issued at field value.
    issuedAt: '',
    // Provide the expires at field value.
    expiresAt: '',
    // Provide the notes field value.
    notes: '',
    // Provide the status field value.
    status: '',
  });
  // Destructure array values into local variables.
  const [complianceFile, setComplianceFile] = useState<File | null>(null);

  // Create the compliance query constant.
  const complianceQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'cars', id, 'compliance'],
    // Provide the query fn field value.
    queryFn: () => getCarCompliance(id),
    // Provide the enabled field value.
    enabled: Boolean(id) && tab === 'compliance',
  });

  // Create the compliance mutation constant.
  const complianceMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () => {
      // Equipment types without validity windows skip issued/expires fields.
      const hasExpiry = complianceTypeHasExpiry(complianceForm.itemType);
      // Create the fd constant.
      const fd = new FormData();
      // Call fd.append to perform this step.
      fd.append('itemType', complianceForm.itemType);
      // Evaluate the condition and enter the branch when it is true.
      if (complianceForm.title) fd.append('title', complianceForm.title);
      // Evaluate the condition and enter the branch when it is true.
      if (complianceForm.referenceNumber) {
        // Call fd.append to perform this step.
        fd.append('referenceNumber', complianceForm.referenceNumber);
      }
      // Evaluate the condition and enter the branch when it is true.
      if (hasExpiry) {
        // Evaluate the condition and enter the branch when it is true.
        if (complianceForm.issuedAt) fd.append('issuedAt', complianceForm.issuedAt);
        // Evaluate the condition and enter the branch when it is true.
        if (complianceForm.expiresAt) fd.append('expiresAt', complianceForm.expiresAt);
      }
      // Evaluate the condition and enter the branch when it is true.
      if (complianceForm.notes) fd.append('notes', complianceForm.notes);
      // Evaluate the condition and enter the branch when it is true.
      if (complianceForm.status === 'missing') fd.append('status', 'missing');
      // Evaluate the condition and enter the branch when it is true.
      if (complianceFile) fd.append('file', complianceFile);
      // Return the resulting value to the caller.
      return createCarCompliance(id, fd);
    },
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Compliance item added', 'success');
      // Call setComplianceForm to perform this step.
      setComplianceForm({
        // Provide the item type field value.
        itemType: 'civil_insurance',
        // Provide the title field value.
        title: '',
        // Provide the reference number field value.
        referenceNumber: '',
        // Provide the issued at field value.
        issuedAt: '',
        // Provide the expires at field value.
        expiresAt: '',
        // Provide the notes field value.
        notes: '',
        // Provide the status field value.
        status: '',
      });
      // Call setComplianceFile to perform this step.
      setComplianceFile(null);
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'compliance'] });
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'fleet-alerts'] });
      // Call refreshCar to perform this step.
      refreshCar(queryClient, id);
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  /** Authenticated download of a compliance attachment; toasts on failure. */
  async function downloadComplianceDocument(itemId: number, filename: string) {
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await downloadCarComplianceDocument(id, itemId, filename);
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    }
  }

  /** Delete a compliance item and refresh car + fleet-alert caches. */
  async function deleteComplianceItem(itemId: number) {
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await deleteCarCompliance(id, itemId);
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'compliance'] });
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'fleet-alerts'] });
      // Call refreshCar to perform this step.
      refreshCar(queryClient, id);
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
    complianceQuery,
    // Contribute this line to the enclosing declaration or statement.
    complianceForm,
    // Contribute this line to the enclosing declaration or statement.
    setComplianceForm,
    // Contribute this line to the enclosing declaration or statement.
    complianceFile,
    // Contribute this line to the enclosing declaration or statement.
    setComplianceFile,
    // Contribute this line to the enclosing declaration or statement.
    complianceMutation,
    // Contribute this line to the enclosing declaration or statement.
    downloadComplianceDocument,
    // Contribute this line to the enclosing declaration or statement.
    deleteComplianceItem,
  };
}
