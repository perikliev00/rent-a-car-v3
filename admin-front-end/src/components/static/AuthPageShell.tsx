import type { ReactNode } from 'react';
import { authAsideImage } from '../../data/marketingAssets';

interface AuthPageShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  sideTitle?: string;
  sideDescription?: string;
}

export function AuthPageShell({
  title,
  subtitle,
  children,
  sideTitle = 'Drive Bulgaria in style',
  sideDescription = 'Premium car rental with transparent pricing and instant online booking.',
}: AuthPageShellProps) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-stretch gap-0 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-14">
      <aside className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-end">
        <img src={authAsideImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="hero-photo-overlay absolute inset-0" />
        <div className="relative z-10 p-10 animate-lux-rise">
          <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-[var(--color-accent)]">
            LuxRide
          </p>
          <h2 className="mt-4 font-display text-3xl font-extrabold uppercase tracking-tight xl:text-4xl">
            {sideTitle}
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-white/85">{sideDescription}</p>
        </div>
      </aside>

      <div className="flex items-center border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-6 py-10 shadow-[var(--shadow-soft)] sm:px-10 lg:border-l-0">
        <div className="w-full animate-lux-rise">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--color-navy)] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
