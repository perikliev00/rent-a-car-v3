/**
 * Fleet card for home/search grids.
 * Search results show trip `totalPrice`; catalog cards fall back to day/tier list price.
 */
import { useEffect, useState } from 'react';
// Import named exports from 'react-router-dom'.
import { Link } from 'react-router-dom';
// Contribute this line to the enclosing declaration or statement.
import type { Car, SearchCar } from '../../types/api';
// Import named exports from '../../utils/format'.
import { formatPrice, imageUrl } from '../../utils/format';
// Import named exports from '../ui/Button'.
import { Button } from '../ui/Button';

// Create the placeholder image constant.
const PLACEHOLDER_IMAGE = '/placeholder-car.svg';

// Declare the CarCardProps TypeScript interface.
interface CarCardProps {
  // Provide the car field value.
  car: Car | SearchCar;
  // Contribute this line to the enclosing declaration or statement.
  detailUrl?: string;
  // Contribute this line to the enclosing declaration or statement.
  showPricing?: boolean;
}

/**
 * Narrow to {@link SearchCar} when the API returned trip-scoped totals.
 *
 * @param car - Catalog or search car payload.
 * @returns Type predicate for search-priced cars.
 */
function hasSearchPricing(car: Car | SearchCar): car is SearchCar {
  // Return the resulting value to the caller.
  return 'totalPrice' in car && typeof car.totalPrice === 'number';
}

/**
 * Compact car teaser with image, specs, and optional price CTA.
 *
 * @param props.car - Car or search-car record to display.
 * @param props.detailUrl - Optional “View” link target.
 * @param props.showPricing - When false, hides the price/CTA row (defaults true).
 * @returns Fleet card article.
 * @remarks Side effect: swaps to the placeholder image on load error.
 */
export function CarCard({ car, detailUrl, showPricing = true }: CarCardProps) {
  // Destructure array values into local variables.
  const [imgSrc, setImgSrc] = useState(() => imageUrl(car.image));

  // Keep the resolved src in sync when the car identity/image changes.
  useEffect(() => {
    // Call setImgSrc to perform this step.
    setImgSrc(imageUrl(car.image));
  // Continue the surrounding logic with this statement.
  }, [car.image]);

  // Prefer trip total from search; otherwise show the best available list day rate.
  const price = hasSearchPricing(car)
    // Contribute this line to the enclosing declaration or statement.
    ? car.totalPrice
    // Contribute this line to the enclosing declaration or statement.
    : car.pricePerDay ?? car.priceTier_1_3 ?? car.price ?? 0;

  // Return control to the caller with the following value.
  return (
    <article className="motion-safe-lift group min-w-0 overflow-hidden border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-lift)]">
      <div className="aspect-[16/10] overflow-hidden bg-[var(--color-navy)]">
        <img
          src={imgSrc}
          alt={car.name}
          className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out)] motion-safe-zoom group-hover:scale-[1.04]"
          loading="lazy"
          onError={() => {
            // Avoid infinite onError loops once we are already on the placeholder.
            if (imgSrc !== PLACEHOLDER_IMAGE) setImgSrc(PLACEHOLDER_IMAGE);
          }}
        />
      </div>
      <div className="min-w-0 px-4 py-5 sm:px-5">
        <h3 className="break-words font-display text-lg font-bold tracking-tight text-[var(--color-navy)]">
          {car.name}
        </h3>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">
          <span>{car.transmission}</span>
          <span aria-hidden>·</span>
          <span>{car.fuelType}</span>
          <span aria-hidden>·</span>
          <span>{car.seats} seats</span>
        </div>
        {showPricing && (
          <div className="mt-5 flex min-w-0 flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-2xl font-extrabold text-[var(--color-navy)]">
                {formatPrice(price)}
              </p>
              {hasSearchPricing(car) && (
                <p className="text-xs text-[var(--color-muted)]">
                  {car.rentalDays} days · incl. delivery
                </p>
              )}
              {!hasSearchPricing(car) && (
                <p className="text-xs text-[var(--color-muted)]">per day (from)</p>
              )}
            </div>
            {detailUrl && (
              <Link to={detailUrl} className="shrink-0">
                <Button size="sm" className="uppercase tracking-[0.06em]">
                  View
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
