/**
 * Contact-form inbox triage (status updates and delete).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from '../../api/admin/contacts'.
import { getContacts, updateContactStatus, deleteContact } from '../../api/admin/contacts';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Select'.
import { Select } from '../../components/ui/Select';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/toastStore'.
import { toast } from '../../components/ui/toastStore';
// Contribute this line to the enclosing declaration or statement.
import type { ContactStatus } from '../../types/api';

/**
 * Contact-form inbox: list messages, change status, confirm-delete.
 */
export function AdminContactsPage() {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'contacts'], queryFn: getContacts });

  // Create the status mutation constant.
  const statusMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: ({ id, status }: { id: string; status: ContactStatus }) =>
      // Call updateContactStatus to perform this step.
      updateContactStatus(id, status),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
      // Call toast to perform this step.
      toast('Status updated', 'success');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the delete mutation constant.
  const deleteMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: deleteContact,
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
      // Call toast to perform this step.
      toast('Message deleted', 'success');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  if (isLoading) return <PageLoader />;

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0">
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">Contacts</h1>
      <p className="mt-1 text-[var(--color-muted)]">Customer messages inbox</p>

      <div className="mt-8 space-y-4">
        {data?.contacts.map((contact) => (
          <Card key={contact.id}>
            <CardBody>
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold">{contact.subject}</h3>
                  <p className="break-words text-sm text-[var(--color-muted)]">
                    {contact.name} · {contact.email}
                    {contact.phone && ` · ${contact.phone}`}
                  </p>
                  <p className="mt-2 break-words text-sm text-[var(--color-ink)]">{contact.message}</p>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {new Date(contact.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Select
                    value={contact.status}
                    onChange={(e) =>
                      statusMutation.mutate({ id: contact.id, status: e.target.value as ContactStatus })
                    }
                    options={[
                      { value: 'new', label: 'New' },
                      { value: 'ready', label: 'Ready' },
                      { value: 'done', label: 'Done' },
                    ]}
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm('Delete this message?')) deleteMutation.mutate(contact.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
        {data?.contacts.length === 0 && (
          <p className="py-12 text-center text-[var(--color-muted)]">No messages</p>
        )}
      </div>
    </div>
  );
}
