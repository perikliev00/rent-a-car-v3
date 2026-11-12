/**
 * Labeled text input primitive with error/tone styling.
 */
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Text field with optional label and inline error message.
 * When `id` is omitted, derives one from the label (lowercased, spaces → hyphens).
 *
 * @param label - Optional visible label
 * @param error - Optional error text (also tints the border)
 * @param id - Explicit input id; otherwise derived from label
 * @param className - Extra classes on the `<input>`
 */
export function Input({ label, error, id, className = '', ...props }: InputProps) {
  // Stable htmlFor/id pairing when callers only pass a label.
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
        className={`w-full min-w-0 max-w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] shadow-sm transition-[border-color,box-shadow] placeholder:text-[var(--color-muted)]/70 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25 ${error ? 'border-[var(--color-danger)]' : ''} ${className}`}
        {...props}
      />
      {error && <p className="break-words text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
