/** Loading indicators: spinner, full-page loader, and skeleton placeholders. */

/**
 * Inline circular spinner for buttons and local loading regions.
 *
 * @param props.className - Extra classes on the centering wrapper.
 */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-accent)]" />
    </div>
  );
}

/**
 * Pulse placeholder block for content that has not loaded yet.
 *
 * @param props.className - Size/shape classes for the skeleton rectangle.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[var(--color-line)]/70 ${className}`} />;
}

/**
 * Centered full-section loader for page-level suspense/loading states.
 *
 * @returns A viewport-tall flex container with a {@link Spinner}.
 */
export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
