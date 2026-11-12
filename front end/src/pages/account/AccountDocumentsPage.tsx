/**
 * Customer document vault: upload identity docs, download, and delete.
 * Uploads use multipart FormData via the account API.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from 'react-router-dom'.
import { Link } from 'react-router-dom';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  deleteCustomerDocument,
  // Contribute this line to the enclosing declaration or statement.
  downloadCustomerDocument,
  // Contribute this line to the enclosing declaration or statement.
  listCustomerDocuments,
  // Contribute this line to the enclosing declaration or statement.
  uploadCustomerDocument,
  // Declare the CustomerDocType TypeScript type alias.
  type CustomerDocType,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/account';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/Select'.
import { Select } from '../../components/ui/Select';
// Import named exports from '../../components/ui/toastStore'.
import { toast } from '../../components/ui/toastStore';
// Import named exports from '../../api/client'.
import { ApiError } from '../../api/client';

/** Human labels for each uploadable document category. */
const DOC_LABELS: Record<CustomerDocType, string> = {
  // Provide the driver license field value.
  driver_license: 'Driver license',
  // Provide the passport id field value.
  passport_id: 'Passport / ID card',
  // Provide the other field value.
  other: 'Other',
};

/**
 * Manage uploaded customer identity documents.
 *
 * @returns Upload form plus list of documents with download/delete actions.
 * @remarks Side effects: uploads/deletes via API; invalidates the documents query; shows toasts.
 */
export function AccountDocumentsPage() {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [docType, setDocType] = useState<CustomerDocType>('driver_license');
  // Destructure array values into local variables.
  const [file, setFile] = useState<File | null>(null);

  // Create the query constant.
  const query = useQuery({
    // Provide the query key field value.
    queryKey: ['account', 'documents'],
    // Provide the query fn field value.
    queryFn: listCustomerDocuments,
  });

  // Create the upload mutation constant.
  const uploadMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (!file) throw new Error('Select a file');
      // Create the form data constant.
      const formData = new FormData();
      // Call formData.append to perform this step.
      formData.append('file', file);
      // Call formData.append to perform this step.
      formData.append('docType', docType);
      // Return the resulting value to the caller.
      return uploadCustomerDocument(formData);
    },
    // Provide the on success field value.
    onSuccess: () => {
      // Call setFile to perform this step.
      setFile(null);
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['account', 'documents'] });
      // Call toast to perform this step.
      toast('Document uploaded', 'success');
    },
    // Provide the on error field value.
    onError: (err) => {
      // Call toast to perform this step.
      toast(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    },
  });

  // Create the delete mutation constant.
  const deleteMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: (id: number) => deleteCustomerDocument(id),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['account', 'documents'] });
      // Call toast to perform this step.
      toast('Document deleted', 'success');
    },
    // Provide the on error field value.
    onError: (err) => {
      // Call toast to perform this step.
      toast(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    },
  });

  if (query.isLoading) return <PageLoader />;

  // Create the documents constant.
  const documents = query.data?.documents ?? [];

  // Return control to the caller with the following value.
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
