import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type FieldTone = 'light' | 'onDark';

interface DateSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  error?: string;
  id?: string;
  className?: string;
  required?: boolean;
  tone?: FieldTone;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parseISODate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDisplay(value: string): string {
  const date = parseISODate(value);
  if (!date) return 'Select date';
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function CalendarIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const triggerClass =
  'flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-left text-sm text-[var(--color-ink)] shadow-sm transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25';

export function DateSelect({
  label,
  value,
  onChange,
  min,
  error,
  id,
  className = '',
  tone = 'light',
}: DateSelectProps) {
  const reactId = useId();
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : reactId);
  const rootRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);

  const selected = parseISODate(value);
  const minDate = min ? parseISODate(min) : null;

  const initialMonth = selected ?? minDate ?? new Date();
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());

  useEffect(() => {
    if (!open) return;
    const base = parseISODate(value) ?? (min ? parseISODate(min) : null) ?? new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
  }, [open, value, min]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setPickerPos(null);
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const width = Math.min(19 * 16, Math.max(0, window.innerWidth - 16));
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setPickerPos({ top: rect.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || pickerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean } | null> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: new Date(viewYear, viewMonth, day), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [viewYear, viewMonth]);

  const canGoPrev = (() => {
    if (!minDate) return true;
    const prevMonthEnd = new Date(viewYear, viewMonth, 0);
    return startOfDay(prevMonthEnd) >= startOfDay(minDate);
  })();

  const goPrev = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const pickDate = (date: Date) => {
    if (minDate && startOfDay(date) < startOfDay(minDate)) return;
    onChange(toISODate(date));
    setOpen(false);
  };

  const todayISO = toISODate(new Date());

  return (
    <div ref={rootRef} className={`relative space-y-1.5 ${className}`}>
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
        <span className="flex items-center gap-2.5">
          <CalendarIcon className="h-4 w-4 text-[var(--color-accent-ink)]" />
          <span>{formatDisplay(value)}</span>
        </span>
        <span className="text-[var(--color-muted)]" aria-hidden>
          ▾
        </span>
      </button>

      {/* Hidden native input keeps form semantics / tests that query by label value via id */}
      <input type="hidden" name={selectId} value={value} readOnly />

      {open &&
        pickerPos &&
        createPortal(
        <div
          ref={pickerRef}
          role="dialog"
          aria-label={label ? `${label} picker` : 'Date picker'}
          style={{ top: pickerPos.top, left: pickerPos.left }}
          className="fixed z-[80] w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-[var(--shadow-lift)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-2.5 sm:px-3 sm:py-3">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink)] disabled:opacity-30"
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
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink)]"
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
                  className={`h-8 rounded-lg text-sm transition-colors sm:h-9 ${
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

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
