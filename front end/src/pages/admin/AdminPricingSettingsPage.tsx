import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSeason,
  deleteSeason,
  getAdminPricing,
  previewPricing,
  updateDeliveryFees,
  updateDeposit,
  updateDiscount,
  updateExtra,
  updateGlobalFee,
  updateSeason,
  updateWeekend,
  type PricingBundle,
  type PricingExtra,
  type PricingSeason,
} from '../../api/admin/pricing';
import { getAdminCars } from '../../api/admin/cars';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Loading';
import { toast } from '../../components/ui/toastStore';
import { formatPrice } from '../../utils/format';

const LOCATION_LABELS: Record<string, string> = {
  office: 'Office',
  'sunny-beach': 'Sunny Beach',
  'sveti-vlas': 'Sveti Vlas',
  nesebar: 'Nesebar',
  burgas: 'Burgas',
  'burgas-airport': 'Burgas Airport',
  sofia: 'Sofia',
  'sofia-airport': 'Sofia Airport',
  varna: 'Varna',
  'varna-airport': 'Varna Airport',
  plovdiv: 'Plovdiv',
  eleni: 'Eleni',
  ravda: 'Ravda',
};

function Section({
  title,
  children,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="mt-6">
      <CardBody>
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
        {hint && <p className="mt-1 text-sm text-[var(--color-muted)]">{hint}</p>}
        <div className="mt-4">{children}</div>
      </CardBody>
    </Card>
  );
}

export function AdminPricingSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'pricing'],
    queryFn: getAdminPricing,
  });
  const { data: carsData } = useQuery({
    queryKey: ['admin', 'cars'],
    queryFn: getAdminCars,
  });

  const pricing = data?.pricing;
  const [feeDraft, setFeeDraft] = useState<Record<string, string> | null>(null);
  const [preview, setPreview] = useState({
    carId: '',
    pickupDate: '',
    returnDate: '',
    pickupLocation: 'office',
    returnLocation: 'burgas-airport',
    hotelDelivery: false,
    extras: [] as string[],
  });
  const [previewResult, setPreviewResult] = useState<{
    lines: { label: string; amount: number }[];
    totalPrice: number;
    deposit: number;
  } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });

  const feesMutation = useMutation({
    mutationFn: updateDeliveryFees,
    onSuccess: () => {
      invalidate();
      toast('Delivery fees saved', 'success');
      setFeeDraft(null);
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const globalFeeMutation = useMutation({
    mutationFn: ({
      feeKey,
      ...rest
    }: {
      feeKey: string;
      label: string;
      amount: number;
      mode: 'flat' | 'per_day';
      active: boolean;
    }) => updateGlobalFee(feeKey, rest),
    onSuccess: () => {
      invalidate();
      toast('Fee saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const seasonMutation = useMutation({
    mutationFn: (payload: { id?: number; data: Omit<PricingSeason, 'id'> }) =>
      payload.id ? updateSeason(payload.id, payload.data) : createSeason(payload.data),
    onSuccess: () => {
      invalidate();
      toast('Season saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: deleteSeason,
    onSuccess: () => {
      invalidate();
      toast('Season deleted', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const weekendMutation = useMutation({
    mutationFn: updateWeekend,
    onSuccess: () => {
      invalidate();
      toast('Weekend rule saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const discountMutation = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number;
    } & Partial<{
      name: string;
      threshold: number;
      adjType: 'percent' | 'fixed';
      adjValue: number;
      active: boolean;
    }>) => updateDiscount(id, data),
    onSuccess: () => {
      invalidate();
      toast('Discount rule saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const depositMutation = useMutation({
    mutationFn: updateDeposit,
    onSuccess: () => {
      invalidate();
      toast('Deposit saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const extraMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<PricingExtra>) => updateExtra(id, data),
    onSuccess: () => {
      invalidate();
      toast('Extra saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const previewMutation = useMutation({
    mutationFn: previewPricing,
    onSuccess: (res) => {
      setPreviewResult({
        lines: res.pricing.lines,
        totalPrice: res.pricing.totalPrice,
        deposit: res.pricing.deposit,
      });
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const feeValues = useMemo(() => {
    if (!pricing) return {};
    if (feeDraft) return feeDraft;
    return Object.fromEntries(pricing.deliveryFees.map((f) => [f.locationId, String(f.fee)]));
  }, [pricing, feeDraft]);

  if (isLoading || !pricing) return <PageLoader />;

  const weekend = pricing.weekendRules[0];
  const deposit = pricing.depositRules[0];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Pricing
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">
            Configure fees, seasons, discounts, deposit, and extras. Vehicle day rates stay on{' '}
            <Link to="/admin/cars" className="text-[var(--color-accent-ink)] hover:underline">
              Cars
            </Link>
            .
          </p>
        </div>
      </div>

      <Section title="Delivery fees" hint="Pickup and return location fees (EUR). Airport locations are included.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-[var(--color-muted)]">
                <th className="pb-2 pr-3">Location</th>
                <th className="pb-2">Fee (€)</th>
              </tr>
            </thead>
            <tbody>
              {pricing.deliveryFees.map((f) => (
                <tr key={f.locationId} className="border-b border-[var(--color-line)]/60">
                  <td className="py-2 pr-3">{LOCATION_LABELS[f.locationId] || f.locationId}</td>
                  <td className="py-2">
                    <Input
                      type="number"
                      step="0.01"
                      className="max-w-[8rem]"
                      value={feeValues[f.locationId] ?? ''}
                      onChange={(e) =>
                        setFeeDraft({ ...feeValues, [f.locationId]: e.target.value })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          className="mt-4"
          loading={feesMutation.isPending}
          onClick={() =>
            feesMutation.mutate(
              Object.entries(feeValues).map(([locationId, fee]) => ({
                locationId,
                fee: Number(fee) || 0,
              }))
            )
          }
        >
          Save delivery fees
        </Button>
      </Section>

      <Section title="Global fees" hint="Hotel delivery, late return, and fuel fees.">
        <div className="space-y-4">
          {pricing.globalFees.map((fee) => (
            <GlobalFeeRow
              key={fee.feeKey}
              fee={fee}
              saving={globalFeeMutation.isPending}
              onSave={(data) => globalFeeMutation.mutate({ feeKey: fee.feeKey, ...data })}
            />
          ))}
        </div>
      </Section>

      <Section title="Seasons">
        <div className="space-y-4">
          {pricing.seasons.map((s) => (
            <SeasonRow
              key={s.id}
              season={s}
              onSave={(data) => seasonMutation.mutate({ id: s.id, data })}
              onDelete={() => deleteSeasonMutation.mutate(s.id)}
            />
          ))}
          <Button
            variant="outline"
            onClick={() =>
              seasonMutation.mutate({
                data: {
                  name: 'High season',
                  startMonth: 6,
                  startDay: 1,
                  endMonth: 8,
                  endDay: 31,
                  adjType: 'percent',
                  adjValue: 20,
                  active: true,
                },
              })
            }
          >
            Add high season (Jun–Aug +20%)
          </Button>
        </div>
      </Section>

      <Section title="Weekend pricing">
        {weekend && (
          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              label="Name"
              defaultValue={weekend.name}
              id={`weekend-name`}
              onBlur={(e) =>
                weekendMutation.mutate({
                  id: weekend.id,
                  name: e.target.value,
                  weekdays: weekend.weekdays,
                  adjType: weekend.adjType,
                  adjValue: weekend.adjValue,
                  active: weekend.active,
                })
              }
            />
            <Input
              label="Adjustment %"
              type="number"
              defaultValue={weekend.adjValue}
              onBlur={(e) =>
                weekendMutation.mutate({
                  id: weekend.id,
                  name: weekend.name,
                  weekdays: weekend.weekdays,
                  adjType: 'percent',
                  adjValue: Number(e.target.value) || 0,
                  active: weekend.active,
                })
              }
            />
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={weekend.active}
                onChange={(e) =>
                  weekendMutation.mutate({
                    id: weekend.id,
                    name: weekend.name,
                    weekdays: weekend.weekdays,
                    adjType: weekend.adjType,
                    adjValue: weekend.adjValue,
                    active: e.target.checked,
                  })
                }
              />
              Active
            </label>
          </div>
        )}
      </Section>

      <Section
        title="Discounts & last-minute"
        hint="Long rental discount is inactive by default so it does not stack with car duration tiers."
      >
        <div className="space-y-4">
          {pricing.discountRules.map((rule) => (
            <div key={rule.id} className="grid gap-3 rounded-lg border border-[var(--color-line)] p-3 sm:grid-cols-5">
              <div>
                <p className="text-xs text-[var(--color-muted)]">Kind</p>
                <p className="font-medium">{rule.kind}</p>
              </div>
              <Input
                label="Name"
                defaultValue={rule.name}
                onBlur={(e) => discountMutation.mutate({ id: rule.id, name: e.target.value })}
              />
              <Input
                label="Threshold"
                type="number"
                defaultValue={rule.threshold}
                onBlur={(e) =>
                  discountMutation.mutate({ id: rule.id, threshold: Number(e.target.value) || 0 })
                }
              />
              <Input
                label="Value"
                type="number"
                defaultValue={rule.adjValue}
                onBlur={(e) =>
                  discountMutation.mutate({ id: rule.id, adjValue: Number(e.target.value) || 0 })
                }
              />
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={rule.active}
                  onChange={(e) => discountMutation.mutate({ id: rule.id, active: e.target.checked })}
                />
                Active
              </label>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Deposit" hint="Shown in breakdown; collected at pickup (not charged in Stripe).">
        {deposit && (
          <div className="flex flex-wrap items-end gap-4">
            <Input
              label="Default deposit (€)"
              type="number"
              defaultValue={deposit.defaultAmount}
              onBlur={(e) =>
                depositMutation.mutate({
                  id: deposit.id,
                  name: deposit.name,
                  defaultAmount: Number(e.target.value) || 0,
                  active: deposit.active,
                })
              }
            />
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={deposit.active}
                onChange={(e) =>
                  depositMutation.mutate({
                    id: deposit.id,
                    name: deposit.name,
                    defaultAmount: deposit.defaultAmount,
                    active: e.target.checked,
                  })
                }
              />
              Active
            </label>
          </div>
        )}
      </Section>

      <Section title="Extras catalog">
        <div className="space-y-3">
          {pricing.extras.map((extra) => (
            <div key={extra.id} className="grid gap-3 rounded-lg border border-[var(--color-line)] p-3 sm:grid-cols-5">
              <div>
                <p className="text-xs text-[var(--color-muted)]">Code</p>
                <p className="font-mono text-sm">{extra.code}</p>
              </div>
              <Input
                label="Label"
                defaultValue={extra.label}
                onBlur={(e) => extraMutation.mutate({ id: extra.id, label: e.target.value })}
              />
              <Input
                label="Amount (€)"
                type="number"
                defaultValue={extra.amount}
                onBlur={(e) => extraMutation.mutate({ id: extra.id, amount: Number(e.target.value) || 0 })}
              />
              <Input
                label="Mode"
                defaultValue={extra.mode}
                onBlur={(e) =>
                  extraMutation.mutate({
                    id: extra.id,
                    mode: e.target.value === 'per_day' ? 'per_day' : 'flat',
                  })
                }
              />
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={extra.active}
                  onChange={(e) => extraMutation.mutate({ id: extra.id, active: e.target.checked })}
                />
                Active
              </label>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Pricing preview" hint="Uses the same engine as checkout.">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-muted)]">Car</span>
            <select
              className="w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2"
              value={preview.carId}
              onChange={(e) => setPreview((p) => ({ ...p, carId: e.target.value }))}
            >
              <option value="">Select car</option>
              {(carsData?.cars || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Pickup date"
            type="date"
            value={preview.pickupDate}
            onChange={(e) => setPreview((p) => ({ ...p, pickupDate: e.target.value }))}
          />
          <Input
            label="Return date"
            type="date"
            value={preview.returnDate}
            onChange={(e) => setPreview((p) => ({ ...p, returnDate: e.target.value }))}
          />
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-muted)]">Pickup location</span>
            <select
              className="w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2"
              value={preview.pickupLocation}
              onChange={(e) => setPreview((p) => ({ ...p, pickupLocation: e.target.value }))}
            >
              {Object.keys(LOCATION_LABELS).map((id) => (
                <option key={id} value={id}>
                  {LOCATION_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-muted)]">Return location</span>
            <select
              className="w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2"
              value={preview.returnLocation}
              onChange={(e) => setPreview((p) => ({ ...p, returnLocation: e.target.value }))}
            >
              {Object.keys(LOCATION_LABELS).map((id) => (
                <option key={id} value={id}>
                  {LOCATION_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={preview.hotelDelivery}
              onChange={(e) => setPreview((p) => ({ ...p, hotelDelivery: e.target.checked }))}
            />
            Hotel delivery
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {pricing.extras
            .filter((e) => e.active)
            .map((extra) => (
              <label key={extra.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={preview.extras.includes(extra.code)}
                  onChange={(e) =>
                    setPreview((p) => ({
                      ...p,
                      extras: e.target.checked
                        ? [...p.extras, extra.code]
                        : p.extras.filter((c) => c !== extra.code),
                    }))
                  }
                />
                {extra.label}
              </label>
            ))}
        </div>
        <Button
          className="mt-4"
          loading={previewMutation.isPending}
          onClick={() => {
            if (!preview.carId || !preview.pickupDate || !preview.returnDate) {
              toast('Select car and dates', 'error');
              return;
            }
            previewMutation.mutate({
              carId: Number(preview.carId),
              pickupDate: preview.pickupDate,
              returnDate: preview.returnDate,
              pickupLocation: preview.pickupLocation,
              returnLocation: preview.returnLocation,
              hotelDelivery: preview.hotelDelivery,
              extras: preview.extras,
            });
          }}
        >
          Run preview
        </Button>
        {previewResult && (
          <div className="mt-4 space-y-2 border-t border-[var(--color-line)] pt-4 text-sm">
            {previewResult.lines.map((line, i) => (
              <div key={`${line.label}-${i}`} className="flex justify-between">
                <span className="text-[var(--color-muted)]">{line.label}</span>
                <span>{formatPrice(line.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-[var(--color-line)] pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatPrice(previewResult.totalPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Deposit</span>
              <span>{formatPrice(previewResult.deposit)}</span>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function GlobalFeeRow({
  fee,
  onSave,
  saving,
}: {
  fee: PricingBundle['globalFees'][0];
  onSave: (data: {
    label: string;
    amount: number;
    mode: 'flat' | 'per_day';
    active: boolean;
  }) => void;
  saving: boolean;
}) {
  const [amount, setAmount] = useState(String(fee.amount));
  const [active, setActive] = useState(fee.active);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-line)] p-3">
      <div className="min-w-[10rem]">
        <p className="text-xs text-[var(--color-muted)]">Fee</p>
        <p className="font-medium">{fee.label}</p>
        <p className="font-mono text-xs text-[var(--color-muted)]">{fee.feeKey}</p>
      </div>
      <Input label="Amount (€)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <Button
        variant="outline"
        loading={saving}
        onClick={() =>
          onSave({ label: fee.label, amount: Number(amount) || 0, mode: fee.mode, active })
        }
      >
        Save
      </Button>
    </div>
  );
}

function SeasonRow({
  season,
  onSave,
  onDelete,
}: {
  season: PricingSeason;
  onSave: (data: Omit<PricingSeason, 'id'>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(season);
  return (
    <div className="grid gap-3 rounded-lg border border-[var(--color-line)] p-3 sm:grid-cols-6">
      <Input
        label="Name"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <Input
        label="Start M"
        type="number"
        value={draft.startMonth}
        onChange={(e) => setDraft({ ...draft, startMonth: Number(e.target.value) })}
      />
      <Input
        label="Start D"
        type="number"
        value={draft.startDay}
        onChange={(e) => setDraft({ ...draft, startDay: Number(e.target.value) })}
      />
      <Input
        label="End M"
        type="number"
        value={draft.endMonth}
        onChange={(e) => setDraft({ ...draft, endMonth: Number(e.target.value) })}
      />
      <Input
        label="End D"
        type="number"
        value={draft.endDay}
        onChange={(e) => setDraft({ ...draft, endDay: Number(e.target.value) })}
      />
      <Input
        label="Value"
        type="number"
        value={draft.adjValue}
        onChange={(e) => setDraft({ ...draft, adjValue: Number(e.target.value) })}
      />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
        />
        Active ({draft.adjType})
      </label>
      <div className="flex gap-2 sm:col-span-4">
        <Button
          variant="outline"
          onClick={() =>
            onSave({
              name: draft.name,
              startMonth: draft.startMonth,
              startDay: draft.startDay,
              endMonth: draft.endMonth,
              endDay: draft.endDay,
              adjType: draft.adjType,
              adjValue: draft.adjValue,
              active: draft.active,
            })
          }
        >
          Save
        </Button>
        <Button variant="outline" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
