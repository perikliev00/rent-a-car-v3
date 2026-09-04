import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  previewPricing,
  type PricingExtra,
} from '../../../api/admin/pricing';
import { getAdminCars } from '../../../api/admin/cars';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/toastStore';
import { formatPrice } from '../../../utils/format';
import { LOCATION_LABELS } from './pricingConstants';
import { PricingSection } from './PricingSection';

export function PricingPreviewSection({ extras }: { extras: PricingExtra[] }) {
  const { data: carsData } = useQuery({
    queryKey: ['admin', 'cars'],
    queryFn: getAdminCars,
  });

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

  return (
    <PricingSection title="Pricing preview" hint="Uses the same engine as checkout.">
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
        {extras
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
    </PricingSection>
  );
}
