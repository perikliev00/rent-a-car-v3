/**
 * Live quote preview against current pricing rules.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  previewPricing,
  // Declare the PricingExtra TypeScript type alias.
  type PricingExtra,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/pricing';
// Import named exports from '../../../api/admin/cars'.
import { getAdminCars } from '../../../api/admin/cars';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Import named exports from '../../../utils/format'.
import { formatPrice } from '../../../utils/format';
// Import named exports from './pricingConstants'.
import { LOCATION_LABELS } from './pricingConstants';
// Import named exports from './PricingSection'.
import { PricingSection } from './PricingSection';

/**
 * Live quote preview form against current pricing rules (no order created).
 * @param extras - Active extras to offer as preview checkboxes
 */
export function PricingPreviewSection({ extras }: { extras: PricingExtra[] }) {
  // Destructure object properties into local variables.
  const { data: carsData } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'cars'],
    // Provide the query fn field value.
    queryFn: getAdminCars,
  });

  // Quote inputs mirrored to {@link previewPricing}.
  const [preview, setPreview] = useState({
    // Provide the car id field value.
    carId: '',
    // Provide the pickup date field value.
    pickupDate: '',
    // Provide the return date field value.
    returnDate: '',
    // Provide the pickup location field value.
    pickupLocation: 'office',
    // Provide the return location field value.
    returnLocation: 'burgas-airport',
    // Provide the hotel delivery field value.
    hotelDelivery: false,
    // Provide the extras field value.
    extras: [] as string[],
  });
  // Destructure array values into local variables.
  const [previewResult, setPreviewResult] = useState<{
    // Provide the lines field value.
    lines: { label: string; amount: number }[];
    // Provide the total price field value.
    totalPrice: number;
    // Provide the deposit field value.
    deposit: number;
  // Continue the surrounding logic with this statement.
  } | null>(null);

  // Create the preview mutation constant.
  const previewMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: previewPricing,
    // Provide the on success field value.
    onSuccess: (res) => {
      // Keep a compact local result for the breakdown UI.
      setPreviewResult({
        // Provide the lines field value.
        lines: res.pricing.lines,
        // Provide the total price field value.
        totalPrice: res.pricing.totalPrice,
        // Provide the deposit field value.
        deposit: res.pricing.deposit,
      });
    },
    // Provide the on error field value.
    onError: (e) => toast((e as Error).message, 'error'),
  });

  // Return control to the caller with the following value.
  return (
    <PricingSection title="Pricing preview" hint="Uses the same engine as checkout.">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
