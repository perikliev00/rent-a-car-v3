import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAdminPricing } from '../../api/admin/pricing';
import { PageLoader } from '../../components/ui/Loading';
import { DeliveryFeesSection } from './pricing/DeliveryFeesSection';
import { DepositSection } from './pricing/DepositSection';
import { DiscountsSection } from './pricing/DiscountsSection';
import { ExtrasSection } from './pricing/ExtrasSection';
import { GlobalFeesSection } from './pricing/GlobalFeesSection';
import { PricingPreviewSection } from './pricing/PricingPreviewSection';
import { SeasonsSection } from './pricing/SeasonsSection';
import { WeekendSection } from './pricing/WeekendSection';

export function AdminPricingSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'pricing'],
    queryFn: getAdminPricing,
  });

  const pricing = data?.pricing;

  if (isLoading || !pricing) return <PageLoader />;

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
