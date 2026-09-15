import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Car, SearchCar } from '../../types/api';
import { formatPrice, imageUrl } from '../../utils/format';
import { Button } from '../ui/Button';

const PLACEHOLDER_IMAGE = '/placeholder-car.svg';

interface CarCardProps {
  car: Car | SearchCar;
  detailUrl?: string;
  showPricing?: boolean;
}

function hasSearchPricing(car: Car | SearchCar): car is SearchCar {
  return 'totalPrice' in car && typeof car.totalPrice === 'number';
}

export function CarCard({ car, detailUrl, showPricing = true }: CarCardProps) {
  const [imgSrc, setImgSrc] = useState(() => imageUrl(car.image));

  useEffect(() => {
    setImgSrc(imageUrl(car.image));
  }, [car.image]);

  const price = hasSearchPricing(car)
    ? car.totalPrice
    : car.pricePerDay ?? car.priceTier_1_3 ?? car.price ?? 0;

  return (
    <article className="motion-safe-lift group min-w-0 overflow-hidden border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-lift)]">
      <div className="aspect-[16/10] overflow-hidden bg-[var(--color-navy)]">
        <img
          src={imgSrc}
          alt={car.name}
          className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out)] motion-safe-zoom group-hover:scale-[1.04]"
          loading="lazy"
          onError={() => {
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
