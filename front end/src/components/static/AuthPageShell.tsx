/**
 * Two-column layout for login/signup/verify pages: form column + branded aside image.
 */
import type { ReactNode } from 'react';
// Import named exports from '../../data/marketingAssets'.
import { authAsideImage } from '../../data/marketingAssets';

// Declare the AuthPageShellProps TypeScript interface.
interface AuthPageShellProps {
  // Provide the title field value.
  title: string;
  // Provide the subtitle field value.
  subtitle: string;
  // Provide the children field value.
  children: ReactNode;
  // Contribute this line to the enclosing declaration or statement.
  sideTitle?: string;
  // Contribute this line to the enclosing declaration or statement.
  sideDescription?: string;
}

/**
 * Two-column auth layout: branded photo aside (lg+) and form column.
 *
 * @param props.title - Form-column heading (e.g. “Sign in”).
 * @param props.subtitle - Short supporting line under the title.
 * @param props.children - Form controls rendered under the subtitle.
 * @param props.sideTitle - Aside headline; defaults to brand marketing copy.
 * @param props.sideDescription - Aside supporting sentence.
 * @returns Responsive auth page shell.
 */
export function AuthPageShell({
  // Contribute this line to the enclosing declaration or statement.
  title,
  // Contribute this line to the enclosing declaration or statement.
  subtitle,
  // Contribute this line to the enclosing declaration or statement.
  children,
  // Update sideTitle with the right-hand side value.
  sideTitle = 'Drive Bulgaria in style',
  // Update sideDescription with the right-hand side value.
  sideDescription = 'Premium car rental with transparent pricing and instant online booking.',
// Continue the surrounding logic with this statement.
}: AuthPageShellProps) {
  // Return control to the caller with the following value.
  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl min-w-0 items-stretch gap-0 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-14">
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

      <div className="flex min-w-0 items-center border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-4 py-8 shadow-[var(--shadow-soft)] sm:px-8 sm:py-10 lg:border-l-0 lg:px-10">
        <div className="w-full min-w-0 animate-lux-rise">
          <h1 className="break-words font-display text-2xl font-extrabold tracking-tight text-[var(--color-navy)] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{subtitle}</p>
          <div className="mt-8 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
