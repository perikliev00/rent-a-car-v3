import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getContacts, updateContactStatus, deleteContact } from '../../api/admin/contacts';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { toast } from '../../components/ui/toastStore';
import type { ContactStatus } from '../../types/api';

export function AdminContactsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'contacts'], queryFn: getContacts });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContactStatus }) =>
      updateContactStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
      toast('Status updated', 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
      toast('Message deleted', 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  if (isLoading) return <PageLoader />;

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
