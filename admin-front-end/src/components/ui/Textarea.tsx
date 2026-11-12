/**
 * Labeled multiline input primitive with error/tone styling.
 */
import type { TextareaHTMLAttributes } from 'react';

// Declare the TextareaProps TypeScript interface.
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  // Contribute this line to the enclosing declaration or statement.
  label?: string;
  // Contribute this line to the enclosing declaration or statement.
  error?: string;
}

/**
 * Multiline field with optional label and inline error message.
 * When `id` is omitted, derives one from the label (lowercased, spaces → hyphens).
 *
 * @param label - Optional visible label
 * @param error - Optional error text (also tints the border)
 * @param id - Explicit textarea id; otherwise derived from label
 * @param className - Extra classes on the `<textarea>`
 */
export function Textarea({ label, error, id, className = '', ...props }: TextareaProps) {
  // Create the textarea id constant.
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  // Return control to the caller with the following value.
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-soft)]"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] shadow-sm transition-[border-color,box-shadow] placeholder:text-[var(--color-muted)]/70 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25 ${error ? 'border-[var(--color-danger)]' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
