import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { imageUrl } from '../../../utils/format';

type DocItem = {
  id: number;
  name: string;
  url: string;
};

export function CarDocumentsTab({
  docName,
  setDocName,
  setDocFile,
  docMutationPending,
  onUpload,
  docsLoading,
  documents,
  onDelete,
}: {
  docName: string;
  setDocName: (v: string) => void;
  setDocFile: (f: File | null) => void;
  docMutationPending: boolean;
  onUpload: () => void;
  docsLoading: boolean;
  documents: DocItem[] | undefined;
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
              <label className="block text-sm font-medium">Image file</label>
              <input
                type="file"
                accept="image/*"
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
                  <a
                    href={imageUrl(d.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-ink)] underline-offset-2 hover:underline"
                  >
                    {d.name}
                  </a>
                  <Button size="sm" variant="danger" onClick={() => void onDelete(d.id)}>
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
