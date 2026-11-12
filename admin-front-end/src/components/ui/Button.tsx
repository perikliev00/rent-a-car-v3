/**
 * Shared button primitive with variant/size styles for admin UI.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const variants = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-ink)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-soft)] font-bold',
  secondary: 'bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-deep)]',
  danger: 'bg-[var(--color-danger)] text-white hover:brightness-110',
  outline:
    'border border-[var(--color-line)] bg-[var(--color-surface-elevated)] text-[var(--color-ink)] hover:border-[var(--color-navy)]/25 hover:bg-[var(--color-surface)]',
  ghost: 'text-[var(--color-muted)] hover:bg-black/5 hover:text-[var(--color-navy)]',
};

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
 * Admin button with semantic variants, sizes, and an optional loading spinner.
 * When `loading` is true the control is also disabled to prevent double submits.
 *
 * @param variant - Visual style (default primary)
 * @param size - Padding/type scale (default md)
 * @param loading - Shows spinner and disables the button
 * @param disabled - Standard disabled flag (OR’d with loading)
 * @param className - Extra classes appended after variant/size
 * @param children - Button label/content
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
      // Loading implies disabled so the spinner cannot be clicked through.
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
