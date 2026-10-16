/** Labeled text input with shared field styling and optional error text. */
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Labeled text input matching the shared form field chrome.
 *
 * @param props.label - Optional visible label; also used to derive `id` when `id` is omitted.
 * @param props.error - Optional validation message shown below the field.
 * @param props.id - Explicit input id; falls back to a slug of `label`.
 * @param props.className - Extra classes merged onto the `<input>`.
 * @returns Label + input + optional error paragraph.
 */
export function Input({ label, error, id, className = '', ...props }: InputProps) {
  // Derive a stable id from the label when the caller does not supply one.
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="min-w-0 space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-soft)]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        // Danger border overrides the default line color when `error` is set.
        className={`w-full min-w-0 max-w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] shadow-sm transition-[border-color,box-shadow] placeholder:text-[var(--color-muted)]/70 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25 ${error ? 'border-[var(--color-danger)]' : ''} ${className}`}
        {...props}
      />
      {error && <p className="break-words text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
