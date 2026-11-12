/**
 * Custom accessible select used in the search form.
 * Supports `light` / `onDark` tones for hero vs white backgrounds.
 */
import { useEffect, useId, useRef, useState } from 'react';

/** Visual tone for labels sitting on light panels vs dark hero surfaces. */
export type FieldTone = 'light' | 'onDark';

/** Single option in a {@link DropdownSelect} list. */
export interface DropdownOption {
  // Provide the value field value.
  value: string;
  // Provide the label field value.
  label: string;
}

// Declare the DropdownSelectProps TypeScript interface.
interface DropdownSelectProps {
  // Contribute this line to the enclosing declaration or statement.
  label?: string;
  // Provide the value field value.
  value: string;
  // Provide the options field value.
  options: DropdownOption[];
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

/** Shared trigger chrome matching DateSelect / TimeSelect. */
const triggerClass =
  // Continue the surrounding logic with this statement.
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
  // Contribute this line to the enclosing declaration or statement.
  label,
  // Contribute this line to the enclosing declaration or statement.
  value,
  // Contribute this line to the enclosing declaration or statement.
  options,
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
}: DropdownSelectProps) {
  // Create the react id constant.
  const reactId = useId();
  // Prefer caller id, else slug(label), else React's unique id.
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : reactId);
  // Create the listbox id constant.
  const listboxId = `${selectId}-listbox`;
  // Create the root ref constant.
  const rootRef = useRef<HTMLDivElement>(null);
  // Destructure array values into local variables.
  const [open, setOpen] = useState(false);
  // Clamp to 0 when the current value is missing from options.
  const selectedIndex = Math.max(
    // Supply the literal value used by the enclosing expression.
    0,
    // Call options.findIndex to perform this step.
    options.findIndex((opt) => opt.value === value),
  );
  // Destructure array values into local variables.
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  // Fall back to the first option for display when value is unknown.
  const selected = options.find((opt) => opt.value === value) ?? options[0];

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;

    // Click outside the root closes the listbox.
    const onPointerDown = (event: MouseEvent) => {
      // Evaluate the condition and enter the branch when it is true.
      if (!rootRef.current?.contains(event.target as Node)) {
        // Call setOpen to perform this step.
        setOpen(false);
      }
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

  // Call useEffect to perform this step.
  useEffect(() => {
    // Reset keyboard highlight to the selected option each time the menu opens.
    if (open) {
      // Call setActiveIndex to perform this step.
      setActiveIndex(selectedIndex);
    }
  // Continue the surrounding logic with this statement.
  }, [open, selectedIndex]);

  /** Commit an option by index and close the menu. */
  const selectOption = (index: number) => {
    // Create the opt constant.
    const opt = options[index];
    // Evaluate the condition and enter the branch when it is true.
    if (!opt) return;
    // Call onChange to perform this step.
    onChange(opt.value);
    // Call setOpen to perform this step.
    setOpen(false);
  };

  /** Open on ArrowDown/Enter/Space; navigate and commit while open. */
  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Evaluate the condition and enter the branch when it is true.
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      // Call event.preventDefault to perform this step.
      event.preventDefault();
      // Evaluate the condition and enter the branch when it is true.
      if (!open) {
        // Call setOpen to perform this step.
        setOpen(true);
        // Return control to the caller with the following value.
        return;
      }
      // Enter/Space commits the highlighted option when already open.
      if (event.key === 'Enter' || event.key === ' ') {
        // Call selectOption to perform this step.
        selectOption(activeIndex);
      }
    }
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;
    // Evaluate the condition and enter the branch when it is true.
    if (event.key === 'ArrowDown') {
      // Call event.preventDefault to perform this step.
      event.preventDefault();
      // Call setActiveIndex to perform this step.
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    }
    // Evaluate the condition and enter the branch when it is true.
    if (event.key === 'ArrowUp') {
      // Call event.preventDefault to perform this step.
      event.preventDefault();
      // Call setActiveIndex to perform this step.
      setActiveIndex((i) => Math.max(0, i - 1));
    }
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
