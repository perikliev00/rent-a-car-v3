/**
 * Document query/mutation hooks for a car.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  deleteCarDocument,
  // Contribute this line to the enclosing declaration or statement.
  downloadCarDocument,
  // Contribute this line to the enclosing declaration or statement.
  getCarDocuments,
  // Contribute this line to the enclosing declaration or statement.
  uploadCarDocument,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/cars';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Contribute this line to the enclosing declaration or statement.
import type { Tab } from './carDetailTypes';

/**
 * Document list/upload/download/delete for a car (active on the Documents tab).
 *
 * @param id - Car id
 * @param tab - Active detail tab
 */
export function useCarDocuments(id: string, tab: Tab) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [docName, setDocName] = useState('');
  // Destructure array values into local variables.
  const [docFile, setDocFile] = useState<File | null>(null);

  // Create the docs query constant.
  const docsQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'cars', id, 'documents'],
    // Provide the query fn field value.
    queryFn: () => getCarDocuments(id),
    // Provide the enabled field value.
    enabled: Boolean(id) && tab === 'documents',
  });

  // Create the doc mutation constant.
  const docMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () => {
      // Evaluate the condition and enter the branch when it is true.
      if (!docFile) throw new Error('Select a file');
      // Create the fd constant.
      const fd = new FormData();
      // Call fd.append to perform this step.
      fd.append('file', docFile);
      // Evaluate the condition and enter the branch when it is true.
      if (docName) fd.append('name', docName);
      // Return the resulting value to the caller.
      return uploadCarDocument(id, fd);
    },
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Document uploaded', 'success');
      // Call setDocFile to perform this step.
      setDocFile(null);
      // Call setDocName to perform this step.
      setDocName('');
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'documents'] });
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  /** Authenticated document download; toasts on failure. */
  async function downloadDocument(docId: number, filename: string) {
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await downloadCarDocument(id, docId, filename);
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    }
  }

  /** Delete a document and invalidate the documents query. */
  async function deleteDocument(docId: number) {
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await deleteCarDocument(id, docId);
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'documents'] });
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
    docsQuery,
    // Contribute this line to the enclosing declaration or statement.
    docName,
    // Contribute this line to the enclosing declaration or statement.
    setDocName,
    // Contribute this line to the enclosing declaration or statement.
    docFile,
    // Contribute this line to the enclosing declaration or statement.
    setDocFile,
    // Contribute this line to the enclosing declaration or statement.
    docMutation,
    // Contribute this line to the enclosing declaration or statement.
    downloadDocument,
    // Contribute this line to the enclosing declaration or statement.
    deleteDocument,
  };
}
