/**
 * Conflict acknowledgment modal before force move/resize/block.
 */
import { Modal } from '../../../components/ui/Modal';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarConflict } from './calendar.types';

/**
 * Lists blocking vs warning conflicts; shows Force only when permitted and no hard blocks.
 *
 * @param open - Modal visibility
 * @param conflicts - Conflicts returned by the calendar mutation
 * @param canOverride - RBAC: user may force soft conflicts
 * @param onClose - Cancel / dismiss
 * @param onForce - Retry the mutation with `force: true`
 */
export function ConflictWarningModal({
  // Contribute this line to the enclosing declaration or statement.
  open,
  // Contribute this line to the enclosing declaration or statement.
  conflicts,
  // Contribute this line to the enclosing declaration or statement.
  canOverride,
  // Contribute this line to the enclosing declaration or statement.
  onClose,
  // Contribute this line to the enclosing declaration or statement.
  onForce,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the open field value.
  open: boolean;
  // Provide the conflicts field value.
  conflicts: CalendarConflict[];
  // Provide the can override field value.
  canOverride: boolean;
  // Provide the on close field value.
  onClose: () => void;
  // Provide the on force field value.
  onForce: () => void;
// Continue the surrounding logic with this statement.
}) {
  // Create the blocks constant.
  const blocks = conflicts.filter((c) => c.severity === 'block');
  // Create the warns constant.
  const warns = conflicts.filter((c) => c.severity === 'warn');
  // Some conflicts (e.g. hard locks) cannot be force-overridden even with permission.
  const hasHardBlock = blocks.some((c) => c.overridable === false);
  // Create the show force constant.
  const showForce = canOverride && !hasHardBlock;

  // Return control to the caller with the following value.
  return (
    <Modal open={open} onClose={onClose} title="Calendar conflict">
      <div className="space-y-4 text-sm">
        <p className="text-[var(--color-muted)]">
          This change conflicts with existing fleet assignments. Review the issues below
          before continuing.
        </p>

        {blocks.length > 0 ? (
          <ConflictGroup
            title="Blocking"
            items={blocks}
            tone="danger"
          />
        ) : null}
        {warns.length > 0 ? (
          <ConflictGroup title="Warnings" items={warns} tone="warn" />
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {showForce ? (
            <Button variant="danger" onClick={onForce}>
              Force anyway
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Styled list of conflicts for one severity group.
 * @param title - Section heading
 * @param items - Conflicts to list
 * @param tone - Visual severity (danger vs warn)
 */
function ConflictGroup({
  // Contribute this line to the enclosing declaration or statement.
  title,
  // Contribute this line to the enclosing declaration or statement.
  items,
  // Contribute this line to the enclosing declaration or statement.
  tone,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the title field value.
  title: string;
  // Provide the items field value.
  items: CalendarConflict[];
  // Provide the tone field value.
  tone: 'danger' | 'warn';
// Continue the surrounding logic with this statement.
}) {
  // Create the border constant.
  const border =
    // Update tone with the right-hand side value.
    tone === 'danger'
      // Continue the surrounding logic with this statement.
      ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5'
      // Continue the surrounding logic with this statement.
      : 'border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)]/50';

  // Return control to the caller with the following value.
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((c, i) => (
          <li key={`${c.code}-${i}`} className={`rounded-lg border px-3 py-2 ${border}`}>
            <div className="font-medium text-[var(--color-ink)]">{c.code}</div>
            <div className="text-[var(--color-muted)]">{c.message}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
