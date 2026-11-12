/** Contact-form inbox APIs for the admin Contacts page. */
import type { Contact, ContactStatus } from '../../types/api';
import { api } from '../client';

/**
 * List all inbound contact-form messages.
 */
export async function getContacts(): Promise<{ contacts: Contact[] }> {
  return api<{ contacts: Contact[] }>('/api/admin/contacts');
}

/**
 * Update workflow status for one contact message (e.g. new → handled).
 *
 * @param id - Contact message id
 * @param status - Target status value
 */
export async function updateContactStatus(
  id: string,
  status: ContactStatus,
): Promise<{ contact: Contact }> {
  return api(`/api/admin/contacts/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/**
 * Permanently delete a contact message.
 * @param id - Contact message id
 */
export async function deleteContact(id: string): Promise<{ deleted: boolean; id: number }> {
  return api(`/api/admin/contacts/${id}`, { method: 'DELETE' });
}
