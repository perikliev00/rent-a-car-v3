import {
  COMPLIANCE_TYPE_OPTIONS,
  complianceTypeHasExpiry,
} from '../../../api/admin/cars';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { complianceStatusClass, type ComplianceForm } from './carDetailTypes';

type ComplianceItem = {
  id: number;
  label: string;
  itemType?: string;
  hasDocument?: boolean;
  referenceNumber?: string | null;
  expiresAt?: string | null;
  status: string;
};

export function CarComplianceTab({
  complianceForm,
  setComplianceForm,
  setComplianceFile,
  complianceMutationPending,
  onAddCompliance,
  complianceLoading,
  items,
  onDownloadDocument,
  onDeleteItem,
}: {
  complianceForm: ComplianceForm;
  setComplianceForm: (v: ComplianceForm | ((prev: ComplianceForm) => ComplianceForm)) => void;
  setComplianceFile: (f: File | null) => void;
  complianceMutationPending: boolean;
  onAddCompliance: () => void;
  complianceLoading: boolean;
  items: ComplianceItem[] | undefined;
  onDownloadDocument: (itemId: number, filename: string) => void;
  onDeleteItem: (itemId: number) => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">Add compliance item</h2>
          <form
            className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onAddCompliance();
            }}
          >
            <Select
              label="Type"
              value={complianceForm.itemType}
              onChange={(e) => {
                const nextType = e.target.value;
                const hasExpiry = complianceTypeHasExpiry(nextType);
                setComplianceForm({
                  ...complianceForm,
                  itemType: nextType,
                  ...(hasExpiry
                    ? {}
                    : { issuedAt: '', expiresAt: '', status: '' as '' | 'missing' }),
                });
              }}
              options={COMPLIANCE_TYPE_OPTIONS}
            />
            <Input
              label="Title (optional)"
              value={complianceForm.title}
              onChange={(e) => setComplianceForm({ ...complianceForm, title: e.target.value })}
            />
            <Input
              label="Reference number"
              value={complianceForm.referenceNumber}
              onChange={(e) =>
                setComplianceForm({ ...complianceForm, referenceNumber: e.target.value })
              }
            />
            {complianceTypeHasExpiry(complianceForm.itemType) ? (
              <>
                <Input
                  label="Issued at"
                  type="date"
                  value={complianceForm.issuedAt}
                  onChange={(e) =>
                    setComplianceForm({ ...complianceForm, issuedAt: e.target.value })
                  }
                />
                <Input
                  label="Expires at"
                  type="date"
                  value={complianceForm.expiresAt}
                  onChange={(e) =>
                    setComplianceForm({ ...complianceForm, expiresAt: e.target.value })
                  }
                />
                <Select
                  label="Status hint"
                  value={complianceForm.status}
                  onChange={(e) =>
                    setComplianceForm({
                      ...complianceForm,
                      status: e.target.value as '' | 'missing',
                    })
                  }
                  options={[
                    { value: '', label: 'Auto from expiry' },
                    { value: 'missing', label: 'Missing' },
                  ]}
                />
              </>
            ) : (
              <Select
                label="Status"
                value={complianceForm.status}
                onChange={(e) =>
                  setComplianceForm({
                    ...complianceForm,
                    status: e.target.value as '' | 'missing',
                  })
                }
                options={[
                  { value: '', label: 'Present' },
                  { value: 'missing', label: 'Missing' },
                ]}
              />
            )}
            <Input
              label="Notes"
              value={complianceForm.notes}
              onChange={(e) => setComplianceForm({ ...complianceForm, notes: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium">File (optional — JPG, PNG, WEBP, PDF)</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                className="mt-1 text-sm"
                onChange={(e) => setComplianceFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={complianceMutationPending}>
                Add item
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">Compliance items</h2>
          {complianceLoading ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">Loading…</p>
          ) : !items?.length ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">No compliance items</p>
          ) : (
            <div className="mt-3 min-w-0 overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[32rem] text-left text-xs">
                <thead>
                  <tr className="border-b text-[var(--color-muted)]">
                    <th className="pb-2 pr-3">Type</th>
                    <th className="pb-2 pr-3">Ref</th>
                    <th className="pb-2 pr-3">Expires</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--color-line)]/60">
                      <td className="py-1.5 pr-3">
                        <div className="text-[var(--color-ink)]">{item.label}</div>
                        {item.hasDocument ? (
                          <button
                            type="button"
                            className="text-[var(--color-muted)] underline-offset-2 hover:underline"
                            onClick={() =>
                              void onDownloadDocument(
                                item.id,
                                `${item.itemType || 'compliance'}-${item.id}`
                              )
                            }
                          >
                            Download file
                          </button>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-3">{item.referenceNumber || '—'}</td>
                      <td className="py-1.5 pr-3">{item.expiresAt || '—'}</td>
                      <td className="py-1.5 pr-3">
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${complianceStatusClass(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-1.5">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void onDeleteItem(item.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
