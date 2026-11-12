/**
 * Calendar range navigation, density/view switcher, and quick actions.
 */
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/DateSelect'.
import { DateSelect } from '../../../components/ui/DateSelect';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarViewMode } from './calendar.types';
// Import named exports from './formatCalendarRangeTitle'.
import { formatCalendarRangeTitle } from './formatCalendarRangeTitle';

/**
 * Calendar range navigation, density/view switcher, and optional agenda preference.
 *
 * @param view - day | week | month
 * @param anchor - Anchor date string for the date picker
 * @param from - Visible range start
 * @param to - Visible range end
 * @param onViewChange - Switch view mode
 * @param onPrev / onNext / onToday - Range navigation
 * @param onAnchorChange - Jump to a picked date
 * @param preferAgenda - Optional day-agenda preference toggle
 * @param onPreferAgendaChange - Persist agenda preference
 */
export function CalendarToolbar({
  // Contribute this line to the enclosing declaration or statement.
  view,
  // Contribute this line to the enclosing declaration or statement.
  anchor,
  // Contribute this line to the enclosing declaration or statement.
  from,
  // Contribute this line to the enclosing declaration or statement.
  to,
  // Contribute this line to the enclosing declaration or statement.
  onViewChange,
  // Contribute this line to the enclosing declaration or statement.
  onPrev,
  // Contribute this line to the enclosing declaration or statement.
  onNext,
  // Contribute this line to the enclosing declaration or statement.
  onToday,
  // Contribute this line to the enclosing declaration or statement.
  onAnchorChange,
  // Contribute this line to the enclosing declaration or statement.
  preferAgenda,
  // Contribute this line to the enclosing declaration or statement.
  onPreferAgendaChange,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the view field value.
  view: CalendarViewMode;
  // Provide the anchor field value.
  anchor: string;
  // Provide the from field value.
  from: Date;
  // Provide the to field value.
  to: Date;
  // Provide the on view change field value.
  onViewChange: (v: CalendarViewMode) => void;
  // Provide the on prev field value.
  onPrev: () => void;
  // Provide the on next field value.
  onNext: () => void;
  // Provide the on today field value.
  onToday: () => void;
  // Provide the on anchor change field value.
  onAnchorChange: (date: string) => void;
  // Contribute this line to the enclosing declaration or statement.
  preferAgenda?: boolean;
  // Continue the surrounding logic with this statement.
  onPreferAgendaChange?: (value: boolean) => void;
// Continue the surrounding logic with this statement.
}) {
  // Create the title constant.
  const title = formatCalendarRangeTitle(view, from, to);

  // Return control to the caller with the following value.
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
