/**
 * Sticky time/day header for the fleet timeline.
 */
import { format } from 'date-fns';
// Import named exports from './timelineLayout'.
import { leftPct } from './timelineLayout';

/** Sticky time/day header for the fleet timeline. */
export function TimelineHeader({
  // Contribute this line to the enclosing declaration or statement.
  hours,
  // Contribute this line to the enclosing declaration or statement.
  labelStep,
  // Contribute this line to the enclosing declaration or statement.
  isDayView,
  // Contribute this line to the enclosing declaration or statement.
  from,
  // Contribute this line to the enclosing declaration or statement.
  totalMinutes,
  // Contribute this line to the enclosing declaration or statement.
  carCol,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the hours field value.
  hours: Date[];
  // Provide the label step field value.
  labelStep: number;
  // Provide the is day view field value.
  isDayView: boolean;
  // Provide the from field value.
  from: Date;
  // Provide the total minutes field value.
  totalMinutes: number;
  // Provide the car col field value.
  carCol: number;
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
  return (
    <div
      className="sticky top-0 z-30 grid border-b border-[var(--color-line)] bg-[var(--color-surface)]"
      style={{ gridTemplateColumns: `${carCol}px 1fr` }}
    >
      <div className="sticky left-0 z-40 border-r border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] sm:px-3">
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
