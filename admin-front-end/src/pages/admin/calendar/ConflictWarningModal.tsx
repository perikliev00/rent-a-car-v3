/**
 * Conflict acknowledgment modal before force move/resize/block.
 */
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
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
  open,
  conflicts,
  canOverride,
  onClose,
  onForce,
}: {
  open: boolean;
  conflicts: CalendarConflict[];
  canOverride: boolean;
  onClose: () => void;
  onForce: () => void;
}) {
  const blocks = conflicts.filter((c) => c.severity === 'block');
  const warns = conflicts.filter((c) => c.severity === 'warn');
  // Some conflicts (e.g. hard locks) cannot be force-overridden even with permission.
  const hasHardBlock = blocks.some((c) => c.overridable === false);
  const showForce = canOverride && !hasHardBlock;

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
  title,
  items,
  tone,
}: {
  title: string;
  items: CalendarConflict[];
  tone: 'danger' | 'warn';
}) {
  const border =
    tone === 'danger'
      ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5'
      : 'border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)]/50';

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
