/** Simple card shell (`Card` / `CardHeader` / `CardBody`) for interactive panels. */
import type { ReactNode } from 'react';

/**
 * Elevated surface container with border and soft shadow.
 *
 * @param props.children - Card contents.
 * @param props.className - Optional extra classes on the outer shell.
 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-[var(--shadow-soft)] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Top section of a card, separated by a bottom border.
 *
 * @param props.children - Header content (titles, actions).
 * @param props.className - Optional extra classes.
 */
export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-b border-[var(--color-line)] px-4 py-4 sm:px-6 ${className}`}>{children}</div>
  );
}

/**
 * Padded body region of a card.
 *
 * @param props.children - Main card content.
 * @param props.className - Optional extra classes.
 */
export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 px-4 py-5 sm:px-6 ${className}`}>{children}</div>;
}
