import { Card, CardBody } from '../../../components/ui/Card';

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
