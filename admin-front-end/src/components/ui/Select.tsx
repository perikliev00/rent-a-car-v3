/**
 * Native select wrapper with admin field styling.
 */
import type { SelectHTMLAttributes } from 'react';

// Declare the SelectProps TypeScript interface.
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  // Contribute this line to the enclosing declaration or statement.
  label?: string;
  // Contribute this line to the enclosing declaration or statement.
  error?: string;
  // Provide the options field value.
  options: Array<{ value: string; label: string }>;
}

/**
 * Labeled native `<select>` with option list and optional error styling.
 * When `id` is omitted, derives one from the label.
 *
 * @param label - Optional visible label
 * @param error - Optional error text (also tints the border)
 * @param options - Value/label pairs rendered as `<option>`s
 * @param id - Explicit select id; otherwise derived from label
 * @param className - Extra classes on the `<select>`
 */
export function Select({ label, error, options, id, className = '', ...props }: SelectProps) {
  // Create the select id constant.
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  // Return control to the caller with the following value.
  return (
    <div className="min-w-0 space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-soft)]"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full min-w-0 max-w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] shadow-sm transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25 ${error ? 'border-[var(--color-danger)]' : ''} ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white text-[var(--color-ink)]">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="break-words text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
