/**
 * Hour/minute picker (15-minute steps) with a portaled popup.
 * Same viewport-aware positioning strategy as {@link DateSelect}.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Minute granularity offered in the picker. */
const MINUTE_STEP = 15;
/** Zero-padded hour strings `00`–`23`. */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
/** Zero-padded minute strings on {@link MINUTE_STEP} boundaries. */
const BASE_MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) =>
  String(i * MINUTE_STEP).padStart(2, '0'),
);

/** Visual tone for labels sitting on light panels vs dark hero surfaces. */
export type FieldTone = 'light' | 'onDark';

interface TimeSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  id?: string;
  className?: string;
  tone?: FieldTone;
}

/**
 * Parse an `HH:MM` string; fall back to 10:00 when malformed.
 *
 * @param value - Candidate time string.
 * @returns Separate hour and minute strings.
 */
function parseHHMM(value: string): { hour: string; minute: string } {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return { hour: '10', minute: '00' };
  return { hour: match[1], minute: match[2] };
}

/** Shared trigger chrome matching DateSelect / DropdownSelect. */
const triggerClass =
  'flex min-h-11 w-full min-w-0 items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-left text-sm text-[var(--color-ink)] shadow-sm transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25';

/**
 * Compute fixed coordinates for the portaled time popup.
 *
 * @param anchor - Trigger element's bounding rect.
 * @param popupHeight - Measured (or estimated) popup height in px.
 * @param popupWidth - Desired popup width before viewport clamping.
 * @returns `top` / `left` / `width` for `position: fixed`.
 */
function computePopupPos(anchor: DOMRect, popupHeight: number, popupWidth: number) {
  const width = Math.min(Math.max(popupWidth, 12 * 16), window.innerWidth - 16);
  const left = Math.min(Math.max(8, anchor.left), Math.max(8, window.innerWidth - width - 8));
  const spaceBelow = window.innerHeight - anchor.bottom - 8;
  const spaceAbove = anchor.top - 8;
  // Flip above when the popup would not fit below and there is more room above.
  const placeAbove = spaceBelow < popupHeight && spaceAbove > spaceBelow;
  const top = placeAbove
    ? Math.max(8, anchor.top - popupHeight - 6)
    : Math.min(anchor.bottom + 6, Math.max(8, window.innerHeight - popupHeight - 8));
  return { top, left, width };
}

/**
 * Hour/minute picker (15-minute steps) with a portaled popup.
 *
 * @param props.label - Optional field label.
 * @param props.value - Controlled `HH:MM` value.
 * @param props.onChange - Called with the updated `HH:MM` string.
 * @param props.error - Optional validation message.
 * @param props.id - Explicit control id.
 * @param props.className - Extra classes on the root wrapper.
 * @param props.tone - Label color for light vs on-dark backgrounds.
 * @returns Labeled time field with portaled hour/minute lists.
 * @remarks Side effects while open: scroll/resize repositioning, outside-click and Escape dismiss.
 */
export function TimeSelect({
  label,
  value,
  onChange,
  error,
  id,
  className = '',
  tone = 'light',
}: TimeSelectProps) {
  const reactId = useId();
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : reactId);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const { hour, minute } = parseHHMM(value);

  // If the current minute is off-step (e.g. from URL), include it so it remains selectable.
  const minuteOptions = useMemo(() => {
    if (BASE_MINUTES.includes(minute)) return BASE_MINUTES;
    return [...BASE_MINUTES, minute].sort((a, b) => Number(a) - Number(b));
  }, [minute]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setPos(null);
      return;
    }

    const update = () => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const height = popupRef.current?.offsetHeight || 220;
      const width = Math.max(rect.width, 12 * 16);
      // Close if the trigger scrolled completely out of the viewport.
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      setPos(computePopupPos(rect, height, width));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popupRef.current?.contains(target)) return;
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

  /** Keep the current minute; replace only the hour portion. */
  const setHour = (nextHour: string) => {
    onChange(`${nextHour}:${minute}`);
  };

  /** Keep the current hour; replace only the minute portion. */
  const setMinute = (nextMinute: string) => {
    onChange(`${hour}:${nextMinute}`);
  };

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
        <span>{`${hour}:${minute}`}</span>
        <span className="text-[var(--color-muted)]" aria-hidden>
          ▾
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-label={label ? `${label} picker` : 'Time picker'}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[80] min-w-[12rem] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-[var(--shadow-lift)]"
          >
            <div className="grid grid-cols-2 border-b border-[var(--color-line)] bg-[var(--color-surface)] text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              <div className="px-2 py-2">Hour</div>
              <div className="px-2 py-2">Min</div>
            </div>
            <div className="grid grid-cols-2">
              <ul className="max-h-48 overflow-y-auto border-r border-[var(--color-line)] py-1 text-sm">
                {HOURS.map((h) => {
                  const selected = h === hour;
                  return (
                    <li key={h}>
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-center ${
                          selected
                            ? 'bg-[var(--color-accent-muted)] font-medium text-[var(--color-ink)]'
                            : 'text-[var(--color-ink)] hover:bg-[var(--color-surface)]'
                        }`}
                        onClick={() => setHour(h)}
                      >
                        {h}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <ul className="max-h-48 overflow-y-auto py-1 text-sm">
                {minuteOptions.map((m) => {
                  const selected = m === minute;
                  return (
                    <li key={m}>
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-center ${
                          selected
                            ? 'bg-[var(--color-accent-muted)] font-medium text-[var(--color-ink)]'
                            : 'text-[var(--color-ink)] hover:bg-[var(--color-surface)]'
                        }`}
                        onClick={() => setMinute(m)}
                      >
                        {m}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body
        )}

      {error && <p className="break-words text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
