/**
 * Custom listbox select used where native selects lack styling control.
 */
import { useEffect, useId, useRef, useState } from 'react';

// Export the field tone type.
export type FieldTone = 'light' | 'onDark';

// Export the dropdown option interface.
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

// Create the trigger class constant.
const triggerClass =
  // Continue the surrounding logic with this statement.
  'flex w-full items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-left text-sm text-[var(--color-ink)] shadow-sm transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25';

/**
 * Accessible custom listbox with keyboard navigation and outside-click dismiss.
 *
 * @param label - Optional visible label
 * @param value - Controlled selected value
 * @param options - Available options
 * @param onChange - Called with the new value when an option is chosen
 * @param error - Optional error text (also tints the trigger border)
 * @param id - Explicit control id; otherwise derived from label or React id
 * @param className - Extra classes on the root
 * @param tone - Label color tone for light vs on-dark surfaces
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
  // Prefer stable id from label; fall back to React useId when unlabeled.
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : reactId);
  // Create the listbox id constant.
  const listboxId = `${selectId}-listbox`;
  // Create the root ref constant.
  const rootRef = useRef<HTMLDivElement>(null);
  // Destructure array values into local variables.
  const [open, setOpen] = useState(false);
  // Clamp unknown values to index 0 so aria-activedescendant stays valid.
  const selectedIndex = Math.max(
    // Supply the literal value used by the enclosing expression.
    0,
    // Call options.findIndex to perform this step.
    options.findIndex((opt) => opt.value === value),
  );
  // Destructure array values into local variables.
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  // Create the selected constant.
  const selected = options.find((opt) => opt.value === value) ?? options[0];

  // Outside click + Escape close the listbox while open.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;

    // Create the on pointer down constant.
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

  // Sync highlight to the selected option each time the menu opens.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
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

  /** Open / navigate / commit from the trigger button keyboard. */
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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-labelledby={label ? `${selectId}-label` : undefined}
        aria-activedescendant={open ? `${selectId}-option-${activeIndex}` : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selected?.label ?? 'Select…'}</span>
        <span className="text-[var(--color-muted)]" aria-hidden>
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
