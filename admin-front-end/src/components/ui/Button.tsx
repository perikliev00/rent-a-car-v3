/**
 * Shared button primitive with variant/size styles for admin UI.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Create the variants constant.
const variants = {
  // Provide the primary field value.
  primary:
    // Continue the surrounding logic with this statement.
    'bg-[var(--color-accent)] text-[var(--color-ink)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-soft)] font-bold',
  // Provide the secondary field value.
  secondary: 'bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-deep)]',
  // Provide the danger field value.
  danger: 'bg-[var(--color-danger)] text-white hover:brightness-110',
  // Provide the outline field value.
  outline:
    // Continue the surrounding logic with this statement.
    'border border-[var(--color-line)] bg-[var(--color-surface-elevated)] text-[var(--color-ink)] hover:border-[var(--color-navy)]/25 hover:bg-[var(--color-surface)]',
  // Provide the ghost field value.
  ghost: 'text-[var(--color-muted)] hover:bg-black/5 hover:text-[var(--color-navy)]',
};

// Create the sizes constant.
const sizes = {
  // Provide the sm field value.
  sm: 'px-3 py-1.5 text-sm',
  // Provide the md field value.
  md: 'px-4 py-2.5 text-sm',
  // Provide the lg field value.
  lg: 'px-6 py-3 text-base',
};

// Declare the ButtonProps TypeScript interface.
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // Contribute this line to the enclosing declaration or statement.
  variant?: keyof typeof variants;
  // Contribute this line to the enclosing declaration or statement.
  size?: keyof typeof sizes;
  // Contribute this line to the enclosing declaration or statement.
  loading?: boolean;
  // Provide the children field value.
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
  // Update variant with the right-hand side value.
  variant = 'primary',
  // Update size with the right-hand side value.
  size = 'md',
  // Contribute this line to the enclosing declaration or statement.
  loading,
  // Contribute this line to the enclosing declaration or statement.
  disabled,
  // Update className with the right-hand side value.
  className = '',
  // Contribute this line to the enclosing declaration or statement.
  children,
  // Spread props into the surrounding structure.
  ...props
// Continue the surrounding logic with this statement.
}: ButtonProps) {
  // Return control to the caller with the following value.
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
