import { Button } from '../../../../components/ui/Button';
import { Field, Section } from './EventDetailsPrimitives';
import { fmt } from './formatEventDate';

export function BlockedEventDetails({
  block,
  eventId,
  canBlocks,
  busy,
  onEditBlock,
  removeBlock,
}: {
  block: Record<string, unknown>;
  eventId: string | null;
  canBlocks: boolean;
  busy: boolean;
  onEditBlock?: (block: Record<string, unknown>, eventId: string) => void;
  removeBlock: () => void | Promise<void>;
}) {
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
