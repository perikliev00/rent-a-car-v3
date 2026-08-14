import type { ReactNode } from 'react';

interface StaticSectionProps {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
  title?: string;
  subtitle?: string;
}

export function StaticSection({
  children,
  className = '',
  narrow = false,
  title,
  subtitle,
}: StaticSectionProps) {
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
