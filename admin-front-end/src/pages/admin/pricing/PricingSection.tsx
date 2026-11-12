/**
 * Reusable section chrome for pricing settings panels.
 */
import { Card, CardBody } from '../../../components/ui/Card';

/**
 * Card wrapper with title and optional hint for pricing settings panels.
 * @param title - Section heading
 * @param children - Section body controls
 * @param hint - Optional muted helper text under the title
 */
export function PricingSection({
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
        {hint && <p className="mt-1 break-words text-sm text-[var(--color-muted)]">{hint}</p>}
        <div className="mt-4 min-w-0">{children}</div>
      </CardBody>
    </Card>
  );
}
