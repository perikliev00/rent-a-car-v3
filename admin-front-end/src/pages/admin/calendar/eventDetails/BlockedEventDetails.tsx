/**
 * Detail panel UI for manual block events.
 */
import { Button } from '../../../../components/ui/Button';
// Import named exports from './EventDetailsPrimitives'.
import { Field, Section } from './EventDetailsPrimitives';
// Import named exports from './formatEventDate'.
import { fmt } from './formatEventDate';

/** Detail panel UI for manual block events. */
export function BlockedEventDetails({
  // Contribute this line to the enclosing declaration or statement.
  block,
  // Contribute this line to the enclosing declaration or statement.
  eventId,
  // Contribute this line to the enclosing declaration or statement.
  canBlocks,
  // Contribute this line to the enclosing declaration or statement.
  busy,
  // Contribute this line to the enclosing declaration or statement.
  onEditBlock,
  // Contribute this line to the enclosing declaration or statement.
  removeBlock,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the block field value.
  block: Record<string, unknown>;
  // Provide the event id field value.
  eventId: string | null;
  // Provide the can blocks field value.
  canBlocks: boolean;
  // Provide the busy field value.
  busy: boolean;
  // Continue the surrounding logic with this statement.
  onEditBlock?: (block: Record<string, unknown>, eventId: string) => void;
  // Provide the remove block field value.
  removeBlock: () => void | Promise<void>;
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
  return (
    <div className="space-y-4 text-sm">
      <Section title="Block">
        <Field label="Title" value={String(block.title || 'Block')} />
        <Field
          label="Type"
          value={String(
            (block.meta as { blockType?: string } | undefined)?.blockType ||
              block.status ||
              'manual',
          )}
        />
        <Field label="Start" value={fmt(String(block.start))} />
        <Field label="End" value={fmt(String(block.end))} />
        <Field
          label="Notes"
          value={String((block.meta as { notes?: string } | undefined)?.notes || '—')}
        />
      </Section>
      <div className="flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-4">
        {(block.meta as { blockType?: string } | undefined)?.blockType === 'booking' ? (
          <p className="w-full text-xs text-[var(--color-muted)]">
            This block is synced to a reservation. Cancel the reservation to free the calendar.
          </p>
        ) : (
          <>
            {canBlocks && onEditBlock && eventId ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onEditBlock(block, eventId)}
              >
                Edit
              </Button>
            ) : null}
            {canBlocks ? (
              <Button size="sm" variant="danger" disabled={busy} onClick={() => void removeBlock()}>
                Delete
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
