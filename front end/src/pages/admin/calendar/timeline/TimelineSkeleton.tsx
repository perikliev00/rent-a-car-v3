export function TimelineSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex h-20 animate-pulse border-b border-[var(--color-line)] last:border-b-0"
        >
          <div className="w-[180px] bg-[var(--color-surface)]/80 p-3">
            <div className="h-3 w-24 rounded bg-[var(--color-line)]" />
            <div className="mt-2 h-2 w-16 rounded bg-[var(--color-line)]" />
          </div>
          <div className="flex-1 bg-[var(--color-surface)]/40" />
        </div>
      ))}
    </div>
  );
}
