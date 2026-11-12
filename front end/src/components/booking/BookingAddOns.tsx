/**
 * Optional extras, insurance packages, and hotel delivery for the booking flow.
 * Insurance codes are mutually exclusive (radio); other extras are checkboxes.
 * Catalog comes from `/api/pricing-info` so amounts stay server-sourced.
 */
import { useQuery } from '@tanstack/react-query';
// Import named exports from '../../api/locations'.
import { getPricingInfo } from '../../api/locations';
// Import named exports from '../../utils/format'.
import { formatPrice } from '../../utils/format';
// Import named exports from '../../utils/searchParams'.
import { normalizeClientExtras } from '../../utils/searchParams';
// Import named exports from '../ui/Card'.
import { Card, CardBody, CardHeader } from '../ui/Card';

// Declare the BookingAddOnsProps TypeScript type alias.
type BookingAddOnsProps = {
  // Provide the extras field value.
  extras: string[];
  // Provide the hotel delivery field value.
  hotelDelivery: boolean;
  // Provide the on change field value.
  onChange: (next: { extras: string[]; hotelDelivery: boolean }) => void;
  // Contribute this line to the enclosing declaration or statement.
  disabled?: boolean;
};

/**
 * True for insurance package codes that must not be combined.
 *
 * @param code - Extra code from the pricing catalog.
 * @returns Whether the code belongs to the insurance radio group.
 */
function isInsuranceCode(code: string) {
  // Return the resulting value to the caller.
  return code.startsWith('insurance_');
}

/**
 * Add-ons panel that writes extras/hotelDelivery back into the URL-driven booking state.
 *
 * @param props.extras - Currently selected extra codes.
 * @param props.hotelDelivery - Whether hotel delivery is selected.
 * @param props.onChange - Called with the next extras/hotelDelivery pair.
 * @param props.disabled - When true, all controls are non-interactive.
 * @returns Add-ons card, a loading placeholder, or `null` when nothing is available.
 */
export function BookingAddOns({ extras, hotelDelivery, onChange, disabled }: BookingAddOnsProps) {
  // Destructure object properties into local variables.
  const { data: pricingInfo, isLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['pricing-info'],
    // Provide the query fn field value.
    queryFn: getPricingInfo,
    // Provide the stale time field value.
    staleTime: 60_000,
  });

  // Create the available extras constant.
  const availableExtras = pricingInfo?.extras || [];
  // Hotel delivery is modeled as a global fee rather than an extra code.
  const hotelFee = pricingInfo?.globalFees?.find((f) => f.feeKey === 'hotel_delivery');
  // Create the deposit constant.
  const deposit = pricingInfo?.deposit ?? 0;

  /**
   * Toggle an extra on/off; insurance codes displace other insurance selections.
   *
   * @param code - Extra code being toggled.
   * @param checked - Desired checked state from the input.
   */
  const toggleExtra = (code: string, checked: boolean) => {
    // Initialize the mutable next variable.
    let next = checked ? [...extras, code] : extras.filter((c) => c !== code);

    // Radio semantics: selecting one insurance package clears the others.
    if (checked && isInsuranceCode(code)) {
      // Update next with the right-hand side value.
      next = next.filter((c) => !isInsuranceCode(c) || c === code);
    }

    // Call onChange to perform this step.
    onChange({
      // Provide the extras field value.
      extras: normalizeClientExtras(next),
      // Contribute this line to the enclosing declaration or statement.
      hotelDelivery,
    });
  };

  // Evaluate the condition and enter the branch when it is true.
  if (isLoading) {
    // Return control to the caller with the following value.
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--color-muted)]">Loading add-ons…</p>
        </CardBody>
      </Card>
    );
  }

  // Nothing to show — avoid an empty card shell.
  if (!availableExtras.length && !hotelFee && !(deposit > 0)) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return control to the caller with the following value.
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
                <label key={extra.code} className="flex min-w-0 items-start gap-3 text-sm">
                  <input
                    type={insuranceGroup ? 'radio' : 'checkbox'}
                    name={insuranceGroup ? 'insurance-package' : undefined}
                    className="mt-1 shrink-0"
                    disabled={disabled}
                    checked={checked}
                    onChange={(e) => toggleExtra(extra.code, e.target.checked)}
                  />
                  <span className="min-w-0 break-words">
                    <span className="font-medium text-[var(--color-ink)]">{extra.label}</span>
                    <span className="ml-2 inline-block text-[var(--color-muted)]">
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
          <label className="flex min-w-0 items-start gap-3 border-t border-[var(--color-line)] pt-4 text-sm">
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              disabled={disabled}
              checked={hotelDelivery}
              onChange={(e) =>
                onChange({
                  extras,
                  hotelDelivery: e.target.checked,
                })
              }
            />
            <span className="min-w-0 break-words">
              <span className="font-medium text-[var(--color-ink)]">
                {hotelFee.label || 'Hotel delivery'}
              </span>
              <span className="ml-2 inline-block text-[var(--color-muted)]">
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
