/**
 * Car document upload/download/delete UI.
 */
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Card'.
import { Card, CardBody } from '../../../components/ui/Card';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';

// Declare the DocItem TypeScript type alias.
type DocItem = {
  // Provide the id field value.
  id: number;
  // Provide the name field value.
  name: string;
  // Contribute this line to the enclosing declaration or statement.
  originalFilename?: string;
  // Contribute this line to the enclosing declaration or statement.
  hasFile?: boolean;
};

/** Car document upload/download/delete UI. */
export function CarDocumentsTab({
  // Contribute this line to the enclosing declaration or statement.
  docName,
  // Contribute this line to the enclosing declaration or statement.
  setDocName,
  // Contribute this line to the enclosing declaration or statement.
  setDocFile,
  // Contribute this line to the enclosing declaration or statement.
  docMutationPending,
  // Contribute this line to the enclosing declaration or statement.
  onUpload,
  // Contribute this line to the enclosing declaration or statement.
  docsLoading,
  // Contribute this line to the enclosing declaration or statement.
  documents,
  // Contribute this line to the enclosing declaration or statement.
  onDownload,
  // Contribute this line to the enclosing declaration or statement.
  onDelete,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the doc name field value.
  docName: string;
  // Provide the set doc name field value.
  setDocName: (v: string) => void;
  // Provide the set doc file field value.
  setDocFile: (f: File | null) => void;
  // Provide the doc mutation pending field value.
  docMutationPending: boolean;
  // Provide the on upload field value.
  onUpload: () => void;
  // Provide the docs loading field value.
  docsLoading: boolean;
  // Provide the documents field value.
  documents: DocItem[] | undefined;
  // Provide the on download field value.
  onDownload: (id: number, filename: string) => void;
  // Provide the on delete field value.
  onDelete: (id: number) => void;
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
  return (
    <div className="mt-6 space-y-4">
      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">Upload document</h2>
          <form
            className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onUpload();
            }}
          >
            <Input
              label="Name"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium">File (JPG, PNG, WEBP, or PDF)</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                className="mt-1 text-sm"
                required
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={docMutationPending}>
                Upload
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">Documents</h2>
          {docsLoading ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">Loading…</p>
          ) : !documents?.length ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">No documents</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {documents.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="text-[var(--color-ink)]">{d.name}</span>
                  <div className="flex gap-2">
                    {d.hasFile !== false ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void onDownload(d.id, d.originalFilename || d.name || 'document')
                        }
                      >
                        Download
                      </Button>
                    ) : null}
                    <Button size="sm" variant="danger" onClick={() => void onDelete(d.id)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
