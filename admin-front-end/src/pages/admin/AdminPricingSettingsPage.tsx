/**
 * Pricing admin hub composing seasons, fees, extras, and preview.
 * Per-car day rates remain on the Cars pages; this page owns global rules only.
 */
import { Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from '../../api/admin/pricing'.
import { getAdminPricing } from '../../api/admin/pricing';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from './pricing/DeliveryFeesSection'.
import { DeliveryFeesSection } from './pricing/DeliveryFeesSection';
// Import named exports from './pricing/DepositSection'.
import { DepositSection } from './pricing/DepositSection';
// Import named exports from './pricing/DiscountsSection'.
import { DiscountsSection } from './pricing/DiscountsSection';
// Import named exports from './pricing/ExtrasSection'.
import { ExtrasSection } from './pricing/ExtrasSection';
// Import named exports from './pricing/GlobalFeesSection'.
import { GlobalFeesSection } from './pricing/GlobalFeesSection';
// Import named exports from './pricing/PricingPreviewSection'.
import { PricingPreviewSection } from './pricing/PricingPreviewSection';
// Import named exports from './pricing/SeasonsSection'.
import { SeasonsSection } from './pricing/SeasonsSection';
// Import named exports from './pricing/WeekendSection'.
import { WeekendSection } from './pricing/WeekendSection';

/** Pricing admin hub composing seasons, fees, extras, and preview. Per-car day rates remain on the Cars pages; this page owns global rules only. */
export function AdminPricingSettingsPage() {
  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'pricing'],
    // Provide the query fn field value.
    queryFn: getAdminPricing,
  });

  // Create the pricing constant.
  const pricing = data?.pricing;

  if (isLoading || !pricing) return <PageLoader />;

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Pricing
          </h1>
          <p className="mt-1 break-words text-[var(--color-muted)]">
            Configure fees, seasons, discounts, deposit, and extras. Vehicle day rates stay on{' '}
            <Link to="/admin/cars" className="text-[var(--color-accent-ink)] hover:underline">
              Cars
            </Link>
            .
          </p>
        </div>
      </div>

      <DeliveryFeesSection fees={pricing.deliveryFees} />
      <GlobalFeesSection fees={pricing.globalFees} />
      <SeasonsSection seasons={pricing.seasons} />
      <WeekendSection rule={pricing.weekendRules[0]} />
      <DiscountsSection rules={pricing.discountRules} />
      <DepositSection rule={pricing.depositRules[0]} />
      <ExtrasSection extras={pricing.extras} />
      <PricingPreviewSection extras={pricing.extras} />
    </div>
  );
}
