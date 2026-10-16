/**
 * Document query/mutation hooks for a car.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteCarDocument,
  downloadCarDocument,
  getCarDocuments,
  uploadCarDocument,
} from '../../../api/admin/cars';
import { toast } from '../../../components/ui/toastStore';
import type { Tab } from './carDetailTypes';

/**
 * Document list/upload/download/delete for a car (active on the Documents tab).
 *
 * @param id - Car id
 * @param tab - Active detail tab
 */
export function useCarDocuments(id: string, tab: Tab) {
  const queryClient = useQueryClient();
  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const docsQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'documents'],
    queryFn: () => getCarDocuments(id),
    enabled: Boolean(id) && tab === 'documents',
  });

  const docMutation = useMutation({
    mutationFn: () => {
      if (!docFile) throw new Error('Select a file');
      const fd = new FormData();
      fd.append('file', docFile);
      if (docName) fd.append('name', docName);
      return uploadCarDocument(id, fd);
    },
    onSuccess: () => {
      toast('Document uploaded', 'success');
      setDocFile(null);
      setDocName('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'documents'] });
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  /** Authenticated document download; toasts on failure. */
  async function downloadDocument(docId: number, filename: string) {
    try {
      await downloadCarDocument(id, docId, filename);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  /** Delete a document and invalidate the documents query. */
  async function deleteDocument(docId: number) {
    try {
      await deleteCarDocument(id, docId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'documents'] });
      toast('Deleted', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return {
    docsQuery,
    docName,
    setDocName,
    docFile,
    setDocFile,
    docMutation,
    downloadDocument,
    deleteDocument,
  };
}
