/** Shared button primitive with variant/size class maps for the design system. */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Visual style tokens keyed by variant name. */
const variants = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-ink)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-soft)] font-bold',
  secondary: 'bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-deep)]',
  danger: 'bg-[var(--color-danger)] text-white hover:brightness-110',
  outline:
    'border border-[var(--color-line)] bg-[var(--color-surface-elevated)] text-[var(--color-ink)] hover:border-[var(--color-navy)]/25 hover:bg-[var(--color-surface)]',
  ghost: 'text-[var(--color-muted)] hover:bg-black/5 hover:text-[var(--color-navy)]',
};

/** Padding/type scale tokens keyed by size name. */
const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  children: ReactNode;
}

/**
 * Design-system button with variant, size, and optional loading spinner.
 *
 * @param props.variant - Visual style (defaults to `primary`).
 * @param props.size - Padding/type scale (defaults to `md`).
 * @param props.loading - When true, shows a spinner and disables the button.
 * @param props.disabled - Native disabled flag; also forced when `loading`.
 * @param props.className - Extra classes merged after variant/size tokens.
 * @param props.children - Button label/content.
 * @returns A styled `<button>` element.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold tracking-tight transition-[color,background-color,transform,box-shadow] duration-200 ease-[var(--ease-out)] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`}
      // Loading also blocks interaction so double-submits cannot fire.
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
