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
  preferAgenda,
  onPreferAgendaChange,
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
  preferAgenda?: boolean;
  onPreferAgendaChange?: (value: boolean) => void;
}) {
  const title = formatCalendarRangeTitle(view, from, to);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="min-h-11" onClick={onPrev}>
          Prev
        </Button>
        <Button size="sm" className="min-h-11" onClick={onToday}>
          Today
        </Button>
        <Button size="sm" variant="outline" className="min-h-11" onClick={onNext}>
          Next
        </Button>
        <div className="w-full min-w-0 max-w-[11rem] sm:w-[11rem]">
          <DateSelect value={anchor} onChange={onAnchorChange} label="" />
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 break-words font-display text-base font-semibold text-[var(--color-ink)] sm:text-lg">
          {title}
        </h2>
        <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-1">
          {(['day', 'week', 'month'] as CalendarViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={`min-h-11 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors duration-200 ease-[var(--ease-out)] ${
                view === v
                  ? 'bg-[var(--color-ink)] text-white'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {v}
            </button>
          ))}
          {onPreferAgendaChange ? (
            <button
              type="button"
              onClick={() => onPreferAgendaChange(!preferAgenda)}
              className={`min-h-11 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                preferAgenda
                  ? 'bg-[var(--color-accent)] text-[var(--color-ink)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
              data-testid="calendar-agenda-toggle"
            >
              Agenda
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
