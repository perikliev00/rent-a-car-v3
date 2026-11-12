/** Native `<select>` with the shared labeled field chrome. */
import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

/**
 * Native `<select>` with the shared labeled field chrome.
 *
 * @param props.label - Optional visible label; also used to derive `id` when `id` is omitted.
 * @param props.error - Optional validation message shown below the field.
 * @param props.options - Value/label pairs rendered as `<option>` elements.
 * @param props.id - Explicit select id; falls back to a slug of `label`.
 * @param props.className - Extra classes merged onto the `<select>`.
 * @returns Label + select + optional error paragraph.
 */
export function Select({ label, error, options, id, className = '', ...props }: SelectProps) {
  // Derive a stable id from the label when the caller does not supply one.
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
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
