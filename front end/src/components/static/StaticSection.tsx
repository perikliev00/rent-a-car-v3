/** Constrained content section with optional title for static pages. */
import type { ReactNode } from 'react';

// Declare the StaticSectionProps TypeScript interface.
interface StaticSectionProps {
  // Provide the children field value.
  children: ReactNode;
  // Contribute this line to the enclosing declaration or statement.
  className?: string;
  // Contribute this line to the enclosing declaration or statement.
  narrow?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  title?: string;
  // Contribute this line to the enclosing declaration or statement.
  subtitle?: string;
}

/**
 * Constrained content section with optional title/subtitle for static pages.
 *
 * @param props.children - Section body content.
 * @param props.className - Extra classes on the `<section>`.
 * @param props.narrow - When true, uses `max-w-3xl` instead of `max-w-7xl`.
 * @param props.title - Optional section heading.
 * @param props.subtitle - Optional supporting copy under the title.
 * @returns A horizontally padded, vertically spaced content section.
 */
export function StaticSection({
  // Contribute this line to the enclosing declaration or statement.
  children,
  // Update className with the right-hand side value.
  className = '',
  // Update narrow with the right-hand side value.
  narrow = false,
  // Contribute this line to the enclosing declaration or statement.
  title,
  // Contribute this line to the enclosing declaration or statement.
  subtitle,
// Continue the surrounding logic with this statement.
}: StaticSectionProps) {
  // Return control to the caller with the following value.
  return (
    <section
      className={`mx-auto px-4 py-14 sm:px-6 ${narrow ? 'max-w-3xl' : 'max-w-7xl'} ${className}`}
    >
      {(title || subtitle) && (
        <div className={`mb-10 ${narrow ? '' : 'max-w-2xl'}`}>
          {title ? (
            <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
              {title}
            </h2>
          ) : null}
          {subtitle ? <p className="mt-2 text-[var(--color-muted)] leading-relaxed">{subtitle}</p> : null}
        </div>
      )}
      {children}
    </section>
  );
}
