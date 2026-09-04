import { format } from 'date-fns';
import { CAR_COL, leftPct } from './timelineLayout';

export function TimelineHeader({
  hours,
  labelStep,
  isDayView,
  from,
  totalMinutes,
}: {
  hours: Date[];
  labelStep: number;
  isDayView: boolean;
  from: Date;
  totalMinutes: number;
}) {
  return (
    <div
      className="sticky top-0 z-30 grid border-b border-[var(--color-line)] bg-[var(--color-surface)]"
      style={{ gridTemplateColumns: `${CAR_COL}px 1fr` }}
    >
      <div className="sticky left-0 z-40 border-r border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Car
      </div>
      <div className="relative h-10">
        {hours
          .filter((_, i) => i % labelStep === 0)
          .map((h) => (
            <div
              key={h.toISOString()}
              className="absolute top-1 text-[10px] text-[var(--color-muted)]"
              style={{ left: `${leftPct(h, from, totalMinutes)}%` }}
            >
              {isDayView ? format(h, 'HH:mm') : format(h, 'MMM d HH:mm')}
            </div>
          ))}
      </div>
    </div>
  );
}
