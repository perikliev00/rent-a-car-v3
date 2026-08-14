import { useQuery } from '@tanstack/react-query';
import { getPricingInfo } from '../../api/locations';
import { formatPrice } from '../../utils/format';
import { normalizeClientExtras } from '../../utils/searchParams';
import { Card, CardBody, CardHeader } from '../ui/Card';

type BookingAddOnsProps = {
  extras: string[];
  hotelDelivery: boolean;
  onChange: (next: { extras: string[]; hotelDelivery: boolean }) => void;
  disabled?: boolean;
};

function isInsuranceCode(code: string) {
  return code.startsWith('insurance_');
}

export function BookingAddOns({ extras, hotelDelivery, onChange, disabled }: BookingAddOnsProps) {
  const { data: pricingInfo, isLoading } = useQuery({
    queryKey: ['pricing-info'],
    queryFn: getPricingInfo,
    staleTime: 60_000,
  });

  const availableExtras = pricingInfo?.extras || [];
  const hotelFee = pricingInfo?.globalFees?.find((f) => f.feeKey === 'hotel_delivery');
  const deposit = pricingInfo?.deposit ?? 0;

  const toggleExtra = (code: string, checked: boolean) => {
    let next = checked ? [...extras, code] : extras.filter((c) => c !== code);

    if (checked && isInsuranceCode(code)) {
      next = next.filter((c) => !isInsuranceCode(c) || c === code);
    }

    onChange({
      extras: normalizeClientExtras(next),
      hotelDelivery,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--color-muted)]">Loading add-ons…</p>
        </CardBody>
      </Card>
    );
  }

  if (!availableExtras.length && !hotelFee && !(deposit > 0)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
          Add-ons &amp; options
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        {availableExtras.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Extras
            </p>
            {availableExtras.map((extra) => {
              const insuranceGroup = isInsuranceCode(extra.code);
              const checked = extras.includes(extra.code);
              return (
                <label key={extra.code} className="flex items-start gap-3 text-sm">
                  <input
                    type={insuranceGroup ? 'radio' : 'checkbox'}
                    name={insuranceGroup ? 'insurance-package' : undefined}
                    className="mt-1"
                    disabled={disabled}
                    checked={checked}
                    onChange={(e) => toggleExtra(extra.code, e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-[var(--color-ink)]">{extra.label}</span>
                    <span className="ml-2 text-[var(--color-muted)]">
                      {formatPrice(extra.amount)}
                      {extra.mode === 'per_day' ? '/day' : ''}
                    </span>
                  </span>
                </label>
              );
            })}
            {availableExtras.some((e) => isInsuranceCode(e.code)) && (
              <button
                type="button"
                className="text-xs text-[var(--color-accent-ink)] hover:underline"
                disabled={disabled || !extras.some(isInsuranceCode)}
                onClick={() =>
                  onChange({
                    extras: extras.filter((c) => !isInsuranceCode(c)),
                    hotelDelivery,
                  })
                }
              >
                Clear insurance package
              </button>
            )}
          </div>
        )}

        {hotelFee && (
          <label className="flex items-start gap-3 border-t border-[var(--color-line)] pt-4 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              disabled={disabled}
              checked={hotelDelivery}
              onChange={(e) =>
                onChange({
                  extras,
                  hotelDelivery: e.target.checked,
                })
              }
            />
            <span>
              <span className="font-medium text-[var(--color-ink)]">
                {hotelFee.label || 'Hotel delivery'}
              </span>
              <span className="ml-2 text-[var(--color-muted)]">
                {formatPrice(hotelFee.amount)}
                {hotelFee.mode === 'per_day' ? '/day' : ''}
              </span>
            </span>
          </label>
        )}

        {deposit > 0 && (
          <p className="border-t border-[var(--color-line)] pt-4 text-sm text-[var(--color-muted)]">
            Security deposit of{' '}
            <span className="font-medium text-[var(--color-ink)]">{formatPrice(deposit)}</span> is due
            at pickup (not charged online).
          </p>
        )}
      </CardBody>
    </Card>
  );
}
