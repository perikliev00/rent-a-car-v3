/**
 * Hour/minute picker (15-minute steps) with a portaled popup.
 * Same viewport-aware positioning strategy as {@link DateSelect}.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
// Import named exports from 'react-dom'.
import { createPortal } from 'react-dom';

/** Minute granularity offered in the picker. */
const MINUTE_STEP = 15;
/** Zero-padded hour strings `00`–`23`. */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
/** Zero-padded minute strings on {@link MINUTE_STEP} boundaries. */
const BASE_MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) =>
  // Call String to perform this step.
  String(i * MINUTE_STEP).padStart(2, '0'),
);

/** Visual tone for labels sitting on light panels vs dark hero surfaces. */
export type FieldTone = 'light' | 'onDark';

// Declare the TimeSelectProps TypeScript interface.
interface TimeSelectProps {
  // Contribute this line to the enclosing declaration or statement.
  label?: string;
  // Provide the value field value.
  value: string;
  // Provide the on change field value.
  onChange: (value: string) => void;
  // Contribute this line to the enclosing declaration or statement.
  error?: string;
  // Contribute this line to the enclosing declaration or statement.
  id?: string;
  // Contribute this line to the enclosing declaration or statement.
  className?: string;
  // Contribute this line to the enclosing declaration or statement.
  tone?: FieldTone;
}

/**
 * Parse an `HH:MM` string; fall back to 10:00 when malformed.
 *
 * @param value - Candidate time string.
 * @returns Separate hour and minute strings.
 */
function parseHHMM(value: string): { hour: string; minute: string } {
  // Create the match constant.
  const match = value.match(/^(\d{2}):(\d{2})$/);
  // Evaluate the condition and enter the branch when it is true.
  if (!match) return { hour: '10', minute: '00' };
  // Return the resulting value to the caller.
  return { hour: match[1], minute: match[2] };
}

/** Shared trigger chrome matching DateSelect / DropdownSelect. */
const triggerClass =
  // Continue the surrounding logic with this statement.
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
  // Create the width constant.
  const width = Math.min(Math.max(popupWidth, 12 * 16), window.innerWidth - 16);
  // Create the left constant.
  const left = Math.min(Math.max(8, anchor.left), Math.max(8, window.innerWidth - width - 8));
  // Create the space below constant.
  const spaceBelow = window.innerHeight - anchor.bottom - 8;
  // Create the space above constant.
  const spaceAbove = anchor.top - 8;
  // Flip above when the popup would not fit below and there is more room above.
  const placeAbove = spaceBelow < popupHeight && spaceAbove > spaceBelow;
  // Create the top constant.
  const top = placeAbove
    // Continue the surrounding logic with this statement.
    ? Math.max(8, anchor.top - popupHeight - 6)
    // Continue the surrounding logic with this statement.
    : Math.min(anchor.bottom + 6, Math.max(8, window.innerHeight - popupHeight - 8));
  // Return the resulting value to the caller.
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
  // Contribute this line to the enclosing declaration or statement.
  label,
  // Contribute this line to the enclosing declaration or statement.
  value,
  // Contribute this line to the enclosing declaration or statement.
  onChange,
  // Contribute this line to the enclosing declaration or statement.
  error,
  // Contribute this line to the enclosing declaration or statement.
  id,
  // Update className with the right-hand side value.
  className = '',
  // Update tone with the right-hand side value.
  tone = 'light',
// Continue the surrounding logic with this statement.
}: TimeSelectProps) {
  // Create the react id constant.
  const reactId = useId();
  // Create the select id constant.
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : reactId);
  // Create the root ref constant.
  const rootRef = useRef<HTMLDivElement>(null);
  // Create the popup ref constant.
  const popupRef = useRef<HTMLDivElement>(null);
  // Destructure array values into local variables.
  const [open, setOpen] = useState(false);
  // Destructure array values into local variables.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  // Destructure object properties into local variables.
  const { hour, minute } = parseHHMM(value);

  // If the current minute is off-step (e.g. from URL), include it so it remains selectable.
  const minuteOptions = useMemo(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (BASE_MINUTES.includes(minute)) return BASE_MINUTES;
    // Return the resulting value to the caller.
    return [...BASE_MINUTES, minute].sort((a, b) => Number(a) - Number(b));
  // Continue the surrounding logic with this statement.
  }, [minute]);

  // Call useLayoutEffect to perform this step.
  useLayoutEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open || !rootRef.current) {
      // Call setPos to perform this step.
      setPos(null);
      // Return control to the caller with the following value.
      return;
    }

    // Create the update constant.
    const update = () => {
      // Evaluate the condition and enter the branch when it is true.
      if (!rootRef.current) return;
      // Create the rect constant.
      const rect = rootRef.current.getBoundingClientRect();
      // Create the height constant.
      const height = popupRef.current?.offsetHeight || 220;
      // Create the width constant.
      const width = Math.max(rect.width, 12 * 16);
      // Close if the trigger scrolled completely out of the viewport.
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        // Call setOpen to perform this step.
        setOpen(false);
        // Return control to the caller with the following value.
        return;
      }
      // Call setPos to perform this step.
      setPos(computePopupPos(rect, height, width));
    };

    // Call update to perform this step.
    update();
    // Call window.addEventListener to perform this step.
    window.addEventListener('resize', update);
    // Call window.addEventListener to perform this step.
    window.addEventListener('scroll', update, true);
    // Continue the surrounding logic with this statement.
    window.visualViewport?.addEventListener('resize', update);
    // Return the resulting value to the caller.
    return () => {
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('resize', update);
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('scroll', update, true);
      // Continue the surrounding logic with this statement.
      window.visualViewport?.removeEventListener('resize', update);
    };
  // Continue the surrounding logic with this statement.
  }, [open]);

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;

    // Create the on pointer down constant.
    const onPointerDown = (event: MouseEvent) => {
      // Create the target constant.
      const target = event.target as Node;
      // Evaluate the condition and enter the branch when it is true.
      if (rootRef.current?.contains(target) || popupRef.current?.contains(target)) return;
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

  /** Keep the current minute; replace only the hour portion. */
  const setHour = (nextHour: string) => {
    // Call onChange to perform this step.
    onChange(`${nextHour}:${minute}`);
  };

  /** Keep the current hour; replace only the minute portion. */
  const setMinute = (nextMinute: string) => {
    // Call onChange to perform this step.
    onChange(`${hour}:${nextMinute}`);
  };

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
