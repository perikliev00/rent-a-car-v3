/**
 * Accessible ISO-date picker with portal popup (avoids native date quirks).
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
// Import named exports from 'react-dom'.
import { createPortal } from 'react-dom';

// Export the field tone type.
export type FieldTone = 'light' | 'onDark';

// Declare the DateSelectProps TypeScript interface.
interface DateSelectProps {
  // Contribute this line to the enclosing declaration or statement.
  label?: string;
  // Provide the value field value.
  value: string;
  // Provide the on change field value.
  onChange: (value: string) => void;
  // Contribute this line to the enclosing declaration or statement.
  min?: string;
  // Contribute this line to the enclosing declaration or statement.
  error?: string;
  // Contribute this line to the enclosing declaration or statement.
  id?: string;
  // Contribute this line to the enclosing declaration or statement.
  className?: string;
  // Contribute this line to the enclosing declaration or statement.
  required?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  tone?: FieldTone;
}

// Create the weekdays constant.
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
// Create the months constant.
const MONTHS = [
  // Supply the literal value used by the enclosing expression.
  'January',
  // Supply the literal value used by the enclosing expression.
  'February',
  // Supply the literal value used by the enclosing expression.
  'March',
  // Supply the literal value used by the enclosing expression.
  'April',
  // Supply the literal value used by the enclosing expression.
  'May',
  // Supply the literal value used by the enclosing expression.
  'June',
  // Supply the literal value used by the enclosing expression.
  'July',
  // Supply the literal value used by the enclosing expression.
  'August',
  // Supply the literal value used by the enclosing expression.
  'September',
  // Supply the literal value used by the enclosing expression.
  'October',
  // Supply the literal value used by the enclosing expression.
  'November',
  // Supply the literal value used by the enclosing expression.
  'December',
];

/**
 * Parse a strict `YYYY-MM-DD` into a local Date, or null if invalid/nonexistent.
 * @param value - ISO date string
 */
function parseISODate(value: string): Date | null {
  // Evaluate the condition and enter the branch when it is true.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  // Destructure array values into local variables.
  const [y, m, d] = value.split('-').map(Number);
  // Create the date constant.
  const date = new Date(y, m - 1, d);
  // Reject overflow dates like 2024-02-31 that JS would roll forward.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  // Return the resulting value to the caller.
  return date;
}

/**
 * Format a Date as `YYYY-MM-DD` in local time.
 * @param date - Local date
 */
function toISODate(date: Date): string {
  // Create the y constant.
  const y = date.getFullYear();
  // Create the m constant.
  const m = String(date.getMonth() + 1).padStart(2, '0');
  // Create the d constant.
  const d = String(date.getDate()).padStart(2, '0');
  // Return the resulting value to the caller.
  return `${y}-${m}-${d}`;
}

/**
 * Truncate a Date to local midnight.
 * @param date - Any datetime
 */
function startOfDay(date: Date): Date {
  // Return the resulting value to the caller.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Human-readable trigger label, or “Select date” when unset/invalid.
 * @param value - Controlled ISO date string
 */
function formatDisplay(value: string): string {
  // Create the date constant.
  const date = parseISODate(value);
  // Evaluate the condition and enter the branch when it is true.
  if (!date) return 'Select date';
  // Return the resulting value to the caller.
  return date.toLocaleDateString('en-GB', {
    // Provide the weekday field value.
    weekday: 'short',
    // Provide the day field value.
    day: 'numeric',
    // Provide the month field value.
    month: 'short',
    // Provide the year field value.
    year: 'numeric',
  });
}

/** Decorative calendar glyph inside the trigger button. */
function CalendarIcon({ className = '' }: { className?: string }) {
  // Return control to the caller with the following value.
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Create the trigger class constant.
const triggerClass =
  // Continue the surrounding logic with this statement.
  'flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-left text-sm text-[var(--color-ink)] shadow-sm transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25';

/**
 * Position the calendar popup under (or above) the trigger within the viewport.
 * @param anchor - Trigger getBoundingClientRect()
 * @param pickerHeight - Measured popup height
 */
function computePickerPos(anchor: DOMRect, pickerHeight: number) {
  // Create the width constant.
  const width = Math.min(19 * 16, Math.max(0, window.innerWidth - 16));
  // Create the left constant.
  const left = Math.min(Math.max(8, anchor.left), Math.max(8, window.innerWidth - width - 8));
  // Create the space below constant.
  const spaceBelow = window.innerHeight - anchor.bottom - 8;
  // Create the space above constant.
  const spaceAbove = anchor.top - 8;
  // Flip above when there is more room above than below.
  const placeAbove = spaceBelow < pickerHeight && spaceAbove > spaceBelow;
  // Create the top constant.
  const top = placeAbove
    // Continue the surrounding logic with this statement.
    ? Math.max(8, anchor.top - pickerHeight - 6)
    // Continue the surrounding logic with this statement.
    : Math.min(anchor.bottom + 6, Math.max(8, window.innerHeight - pickerHeight - 8));
  // Return the resulting value to the caller.
  return { top, left, width };
}

/** Accessible ISO-date picker with portal popup (avoids native date quirks). */
export function DateSelect({
  // Contribute this line to the enclosing declaration or statement.
  label,
  // Contribute this line to the enclosing declaration or statement.
  value,
  // Contribute this line to the enclosing declaration or statement.
  onChange,
  // Contribute this line to the enclosing declaration or statement.
  min,
  // Contribute this line to the enclosing declaration or statement.
  error,
  // Contribute this line to the enclosing declaration or statement.
  id,
  // Update className with the right-hand side value.
  className = '',
  // Update tone with the right-hand side value.
  tone = 'light',
// Continue the surrounding logic with this statement.
}: DateSelectProps) {
  // Create the react id constant.
  const reactId = useId();
  // Create the select id constant.
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : reactId);
  // Create the root ref constant.
  const rootRef = useRef<HTMLDivElement>(null);
  // Create the picker ref constant.
  const pickerRef = useRef<HTMLDivElement>(null);
  // Destructure array values into local variables.
  const [open, setOpen] = useState(false);
  // Destructure array values into local variables.
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number; width: number } | null>(
    // Supply the literal value used by the enclosing expression.
    null
  );

  // Create the selected constant.
  const selected = parseISODate(value);
  // Create the min date constant.
  const minDate = min ? parseISODate(min) : null;

  // Create the initial month constant.
  const initialMonth = selected ?? minDate ?? new Date();
  // Destructure array values into local variables.
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  // Destructure array values into local variables.
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;
    // Create the base constant.
    const base = parseISODate(value) ?? (min ? parseISODate(min) : null) ?? new Date();
    // Call setViewYear to perform this step.
    setViewYear(base.getFullYear());
    // Call setViewMonth to perform this step.
    setViewMonth(base.getMonth());
  // Continue the surrounding logic with this statement.
  }, [open, value, min]);

  // Call useLayoutEffect to perform this step.
  useLayoutEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open || !rootRef.current) {
      // Call setPickerPos to perform this step.
      setPickerPos(null);
      // Return control to the caller with the following value.
      return;
    }

    // Create the update constant.
    const update = () => {
      // Evaluate the condition and enter the branch when it is true.
      if (!rootRef.current) return;
      // Create the rect constant.
      const rect = rootRef.current.getBoundingClientRect();
      // Create the picker height constant.
      const pickerHeight = pickerRef.current?.offsetHeight || 320;
      // Evaluate the condition and enter the branch when it is true.
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        // Call setOpen to perform this step.
        setOpen(false);
        // Return control to the caller with the following value.
        return;
      }
      // Call setPickerPos to perform this step.
      setPickerPos(computePickerPos(rect, pickerHeight));
    };

    // Call update to perform this step.
    update();
    // Call window.addEventListener to perform this step.
    window.addEventListener('resize', update);
    // Call window.addEventListener to perform this step.
    window.addEventListener('scroll', update, true);
    // Continue the surrounding logic with this statement.
    window.visualViewport?.addEventListener('resize', update);
    // Continue the surrounding logic with this statement.
    window.visualViewport?.addEventListener('scroll', update);
    // Return the resulting value to the caller.
    return () => {
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('resize', update);
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('scroll', update, true);
      // Continue the surrounding logic with this statement.
      window.visualViewport?.removeEventListener('resize', update);
      // Continue the surrounding logic with this statement.
      window.visualViewport?.removeEventListener('scroll', update);
    };
  // Continue the surrounding logic with this statement.
  }, [open, viewYear, viewMonth]);

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;

    // Create the on pointer down constant.
    const onPointerDown = (event: MouseEvent) => {
      // Create the target constant.
      const target = event.target as Node;
      // Evaluate the condition and enter the branch when it is true.
      if (rootRef.current?.contains(target) || pickerRef.current?.contains(target)) {
        // Return control to the caller with the following value.
        return;
      }
      // Call setOpen to perform this step.
      setOpen(false);
    };

    // Create the on key down constant.
    const onKeyDown = (event: KeyboardEvent) => {
      // Evaluate the condition and enter the branch when it is true.
      if (event.key === 'Escape') {
        // Call event.preventDefault to perform this step.
        event.preventDefault();
        // Call setOpen to perform this step.
        setOpen(false);
      }
    };

    // Call document.addEventListener to perform this step.
    document.addEventListener('mousedown', onPointerDown);
    // Call document.addEventListener to perform this step.
    document.addEventListener('keydown', onKeyDown);
    // Return the resulting value to the caller.
    return () => {
      // Call document.removeEventListener to perform this step.
      document.removeEventListener('mousedown', onPointerDown);
      // Call document.removeEventListener to perform this step.
      document.removeEventListener('keydown', onKeyDown);
    };
  // Continue the surrounding logic with this statement.
  }, [open]);

  // Create the days constant.
  const days = useMemo(() => {
    // Create the first constant.
    const first = new Date(viewYear, viewMonth, 1);
    // Create the start offset constant.
    const startOffset = (first.getDay() + 6) % 7;
    // Create the days in month constant.
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Continue the surrounding logic with this statement.
    const cells: Array<{ date: Date; inMonth: boolean } | null> = [];

    // Iterate using the loop initializer, condition, and step.
    for (let i = 0; i < startOffset; i += 1) {
      // Call cells.push to perform this step.
      cells.push(null);
    }
    // Iterate using the loop initializer, condition, and step.
    for (let day = 1; day <= daysInMonth; day += 1) {
      // Call cells.push to perform this step.
      cells.push({ date: new Date(viewYear, viewMonth, day), inMonth: true });
    }
    // Keep looping while the condition remains true.
    while (cells.length % 7 !== 0) {
      // Call cells.push to perform this step.
      cells.push(null);
    }
    // Return the resulting value to the caller.
    return cells;
  // Continue the surrounding logic with this statement.
  }, [viewYear, viewMonth]);

  // Create the can go prev constant.
  const canGoPrev = (() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!minDate) return true;
    // Create the prev month end constant.
    const prevMonthEnd = new Date(viewYear, viewMonth, 0);
    // Return the resulting value to the caller.
    return startOfDay(prevMonthEnd) >= startOfDay(minDate);
  // Continue the surrounding logic with this statement.
  })();

  // Create the go prev constant.
  const goPrev = () => {
    // Evaluate the condition and enter the branch when it is true.
    if (!canGoPrev) return;
    // Evaluate the condition and enter the branch when it is true.
    if (viewMonth === 0) {
      // Call setViewYear to perform this step.
      setViewYear((y) => y - 1);
      // Call setViewMonth to perform this step.
      setViewMonth(11);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Call setViewMonth to perform this step.
      setViewMonth((m) => m - 1);
    }
  };

  // Create the go next constant.
  const goNext = () => {
    // Evaluate the condition and enter the branch when it is true.
    if (viewMonth === 11) {
      // Call setViewYear to perform this step.
      setViewYear((y) => y + 1);
      // Call setViewMonth to perform this step.
      setViewMonth(0);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Call setViewMonth to perform this step.
      setViewMonth((m) => m + 1);
    }
  };

  // Create the pick date constant.
  const pickDate = (date: Date) => {
    // Evaluate the condition and enter the branch when it is true.
    if (minDate && startOfDay(date) < startOfDay(minDate)) return;
    // Call onChange to perform this step.
    onChange(toISODate(date));
    // Call setOpen to perform this step.
    setOpen(false);
  };

  // Create the today iso constant.
  const todayISO = toISODate(new Date());

  // Return control to the caller with the following value.
  return (
    <div ref={rootRef} className={`relative min-w-0 space-y-1.5 ${className}`}>
      {label && (
        <label
          id={`${selectId}-label`}
          htmlFor={selectId}
          className={`block text-xs font-semibold uppercase tracking-[0.06em] ${
            tone === 'onDark' ? 'text-white' : 'text-[var(--color-ink-soft)]'
          }`}
        >
          {label}
        </label>
      )}
      <button
        type="button"
        id={selectId}
        className={`${triggerClass} ${error ? 'border-[var(--color-danger)]' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={label ? `${selectId}-label` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <CalendarIcon className="h-4 w-4 shrink-0 text-[var(--color-accent-ink)]" />
          <span className="truncate">{formatDisplay(value)}</span>
        </span>
        <span className="shrink-0 text-[var(--color-muted)]" aria-hidden>
          ▾
        </span>
      </button>

      <input type="hidden" name={selectId} value={value} readOnly />

      {open &&
        pickerPos &&
        createPortal(
          <div
            ref={pickerRef}
            role="dialog"
            aria-label={label ? `${label} picker` : 'Date picker'}
            style={{ top: pickerPos.top, left: pickerPos.left, width: pickerPos.width }}
            className="fixed z-[80] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-[var(--shadow-lift)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-2.5 sm:px-3 sm:py-3">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink)] disabled:opacity-30"
                onClick={goPrev}
                disabled={!canGoPrev}
                aria-label="Previous month"
              >
                ‹
              </button>
              <p className="font-display text-sm font-semibold tracking-tight">
                {MONTHS[viewMonth]} {viewYear}
              </p>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink)]"
                onClick={goNext}
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 px-2 pt-2 text-center text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--color-muted)] sm:gap-1 sm:px-3 sm:pt-3 sm:text-[0.65rem]">
              {WEEKDAYS.map((day) => (
                <span key={day} className="py-1">
                  {day}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 px-2 pb-2 pt-1 sm:gap-1 sm:px-3 sm:pb-3">
              {days.map((cell, index) => {
                if (!cell) {
                  return <span key={`empty-${index}`} className="h-8 sm:h-9" />;
                }

                const iso = toISODate(cell.date);
                const disabled = Boolean(minDate && startOfDay(cell.date) < startOfDay(minDate));
                const isSelected = value === iso;
                const isToday = iso === todayISO;

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    aria-label={iso}
                    aria-pressed={isSelected}
                    onClick={() => pickDate(cell.date)}
                    className={`h-9 rounded-lg text-sm transition-colors sm:h-10 ${
                      isSelected
                        ? 'bg-[var(--color-accent)] font-semibold text-[var(--color-ink)]'
                        : isToday
                          ? 'bg-[var(--color-accent-muted)] font-medium text-[var(--color-ink)] hover:bg-[var(--color-accent)]/40'
                          : 'text-[var(--color-ink)] hover:bg-[var(--color-surface)]'
                    } disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}

      {error && <p className="break-words text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
