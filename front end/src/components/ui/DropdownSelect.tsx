/**
 * Custom accessible select used in the search form.
 * Supports `light` / `onDark` tones for hero vs white backgrounds.
 */
import { useEffect, useId, useRef, useState } from 'react';

/** Visual tone for labels sitting on light panels vs dark hero surfaces. */
export type FieldTone = 'light' | 'onDark';

/** Single option in a {@link DropdownSelect} list. */
export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  label?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  error?: string;
  id?: string;
  className?: string;
  tone?: FieldTone;
}

/** Shared trigger chrome matching DateSelect / TimeSelect. */
const triggerClass =
  'flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-left text-sm text-[var(--color-ink)] shadow-sm transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25';

/**
 * Custom accessible select used in the search form.
 *
 * @param props.label - Optional field label (also drives derived ids).
 * @param props.value - Currently selected option value.
 * @param props.options - Available options.
 * @param props.onChange - Called with the new value when an option is chosen.
 * @param props.error - Optional validation message under the field.
 * @param props.id - Explicit control id; derived from label/react id otherwise.
 * @param props.className - Extra classes on the root wrapper.
 * @param props.tone - Label color for light vs on-dark backgrounds.
 * @returns Labeled custom select with listbox popup.
 * @remarks Side effects while open: document mousedown/Escape listeners to dismiss.
 */
export function DropdownSelect({
  label,
  value,
  options,
  onChange,
  error,
  id,
  className = '',
  tone = 'light',
}: DropdownSelectProps) {
  const reactId = useId();
  // Prefer caller id, else slug(label), else React's unique id.
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : reactId);
  const listboxId = `${selectId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Clamp to 0 when the current value is missing from options.
  const selectedIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  // Fall back to the first option for display when value is unknown.
  const selected = options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    // Click outside the root closes the listbox.
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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

  useEffect(() => {
    // Reset keyboard highlight to the selected option each time the menu opens.
    if (open) {
      setActiveIndex(selectedIndex);
    }
  }, [open, selectedIndex]);

  /** Commit an option by index and close the menu. */
  const selectOption = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  /** Open on ArrowDown/Enter/Space; navigate and commit while open. */
  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      // Enter/Space commits the highlighted option when already open.
      if (event.key === 'Enter' || event.key === ' ') {
        selectOption(activeIndex);
      }
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    }
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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-labelledby={label ? `${selectId}-label` : undefined}
        aria-activedescendant={open ? `${selectId}-option-${activeIndex}` : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="min-w-0 truncate">{selected?.label ?? 'Select…'}</span>
        <span className="shrink-0 text-[var(--color-muted)]" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={label ? `${selectId}-label` : undefined}
          className="absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] py-1 text-sm text-[var(--color-ink)] shadow-[var(--shadow-lift)]"
        >
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isActive = index === activeIndex;
            return (
              <li
                key={opt.value}
                id={`${selectId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                className={`cursor-pointer px-3.5 py-2 ${
                  isSelected
                    ? 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]'
                    : isActive
                      ? 'bg-[var(--color-surface)]'
                      : 'hover:bg-[var(--color-surface)]'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(index)}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
