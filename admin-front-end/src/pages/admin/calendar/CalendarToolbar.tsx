import { Button } from '../../../components/ui/Button';
import { DateSelect } from '../../../components/ui/DateSelect';
import type { CalendarViewMode } from './calendar.types';
import { formatCalendarRangeTitle } from './formatCalendarRangeTitle';

export function CalendarToolbar({
  view,
  anchor,
  from,
  to,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onAnchorChange,
}: {
  view: CalendarViewMode;
  anchor: string;
  from: Date;
  to: Date;
  onViewChange: (v: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onAnchorChange: (date: string) => void;
}) {
  const title = formatCalendarRangeTitle(view, from, to);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onPrev}>
          Prev
        </Button>
        <Button size="sm" onClick={onToday}>
          Today
        </Button>
        <Button size="sm" variant="outline" onClick={onNext}>
          Next
        </Button>
        <h2 className="ml-1 font-display text-lg font-semibold text-[var(--color-ink)] sm:ml-2">
          {title}
        </h2>
        <div className="w-[11rem]">
          <DateSelect value={anchor} onChange={onAnchorChange} label="" />
        </div>
      </div>
      <div className="flex gap-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-1">
        {(['day', 'week', 'month'] as CalendarViewMode[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors duration-200 ease-[var(--ease-out)] ${
              view === v
                ? 'bg-[var(--color-ink)] text-white'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
