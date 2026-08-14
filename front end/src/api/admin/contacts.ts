import type { Contact, ContactStatus } from '../../types/api';
import { api } from '../client';

export async function getContacts(): Promise<{ contacts: Contact[] }> {
  return api<{ contacts: Contact[] }>('/api/admin/contacts');
}

export async function updateContactStatus(
  id: string,
  status: ContactStatus,
): Promise<{ contact: Contact }> {
  return api(`/api/admin/contacts/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteContact(id: string): Promise<{ deleted: boolean; id: number }> {
  return api(`/api/admin/contacts/${id}`, { method: 'DELETE' });
}
