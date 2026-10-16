/**
 * Inline loading spinner used while admin queries resolve.
 */

/**
 * Centered circular spinner.
 * @param className - Extra classes on the outer flex wrapper
 */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-accent)]" />
    </div>
  );
}

/**
 * Pulse placeholder block for skeleton layouts.
 * @param className - Size/shape classes for the skeleton bar
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[var(--color-line)]/70 ${className}`} />;
}

/** Full-page-ish centered spinner for route-level loading. */
export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
