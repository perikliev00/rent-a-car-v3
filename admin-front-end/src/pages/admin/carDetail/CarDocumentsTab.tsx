import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';

type DocItem = {
  id: number;
  name: string;
  originalFilename?: string;
  hasFile?: boolean;
};

export function CarDocumentsTab({
  docName,
  setDocName,
  setDocFile,
  docMutationPending,
  onUpload,
  docsLoading,
  documents,
  onDownload,
  onDelete,
}: {
  docName: string;
  setDocName: (v: string) => void;
  setDocFile: (f: File | null) => void;
  docMutationPending: boolean;
  onUpload: () => void;
  docsLoading: boolean;
  documents: DocItem[] | undefined;
  onDownload: (id: number, filename: string) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">Upload document</h2>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
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
