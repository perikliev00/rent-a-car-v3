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
  // Contribute this line to the enclosing declaration or statement.
  title,
  // Contribute this line to the enclosing declaration or statement.
  children,
  // Contribute this line to the enclosing declaration or statement.
  hint,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the title field value.
  title: string;
  // Provide the children field value.
  children: React.ReactNode;
  // Contribute this line to the enclosing declaration or statement.
  hint?: string;
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
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
