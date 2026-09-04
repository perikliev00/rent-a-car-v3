import { type ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </h4>
      {children}
    </section>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </div>
      <div className="text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
