import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  deleteCustomerDocument,
  downloadCustomerDocument,
  listCustomerDocuments,
  uploadCustomerDocument,
  type CustomerDocType,
} from '../../api/account';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/toastStore';
import { ApiError } from '../../api/client';

const DOC_LABELS: Record<CustomerDocType, string> = {
  driver_license: 'Driver license',
  passport_id: 'Passport / ID card',
  other: 'Other',
};

export function AccountDocumentsPage() {
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState<CustomerDocType>('driver_license');
  const [file, setFile] = useState<File | null>(null);

  const query = useQuery({
    queryKey: ['account', 'documents'],
    queryFn: listCustomerDocuments,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Select a file');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      return uploadCustomerDocument(formData);
    },
    onSuccess: () => {
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['account', 'documents'] });
      toast('Document uploaded', 'success');
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCustomerDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'documents'] });
      toast('Document deleted', 'success');
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    },
  });

  if (query.isLoading) return <PageLoader />;

  const documents = query.data?.documents ?? [];

  return (
    <div className="mx-auto min-w-0 max-w-3xl overflow-x-clip px-4 py-10 sm:px-6">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-accent-ink)]">My account</p>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-[var(--color-navy)]">Documents</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Upload your driver license and passport/ID securely. Files are not publicly accessible.
          </p>
        </div>
        <Link to="/account">
          <Button variant="outline" size="sm">
            Dashboard
          </Button>
        </Link>
      </div>

      <Card className="mt-8">
        <CardBody className="min-w-0 space-y-4">
          <Select
            label="Document type"
            value={docType}
            onChange={(e) => setDocType(e.target.value as CustomerDocType)}
            options={[
              { value: 'driver_license', label: 'Driver license' },
              { value: 'passport_id', label: 'Passport / ID card' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
              File (JPG, PNG, WEBP, or PDF, max 5MB)
            </label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full max-w-full min-w-0 text-sm text-[var(--color-muted)]"
            />
          </div>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            loading={uploadMutation.isPending}
            disabled={!file}
            onClick={() => uploadMutation.mutate()}
          >
            Upload
          </Button>
        </CardBody>
      </Card>

      <section className="mt-10 min-w-0">
        <h2 className="font-display text-lg font-semibold">Uploaded documents</h2>
        {!documents.length ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No documents uploaded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {documents.map((doc) => (
              <li key={doc.id} className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-ink)]">
                    {DOC_LABELS[doc.docType] || doc.docType}
                  </p>
                  <p className="break-all text-sm text-[var(--color-muted)]">{doc.originalFilename}</p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await downloadCustomerDocument(doc.id, doc.originalFilename);
                      } catch {
                        toast('Download failed', 'error');
                      }
                    }}
                  >
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(doc.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
