/** Contact-form inbox APIs for the admin Contacts page. */
import type { Contact, ContactStatus } from '../../types/api';
// Import named exports from '../client'.
import { api } from '../client';

/**
 * List all inbound contact-form messages.
 */
export async function getContacts(): Promise<{ contacts: Contact[] }> {
  // Return the resulting value to the caller.
  return api<{ contacts: Contact[] }>('/api/admin/contacts');
}

/**
 * Update workflow status for one contact message (e.g. new → handled).
 *
 * @param id - Contact message id
 * @param status - Target status value
 */
export async function updateContactStatus(
  // Provide the id field value.
  id: string,
  // Provide the status field value.
  status: ContactStatus,
// Continue the surrounding logic with this statement.
): Promise<{ contact: Contact }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/contacts/${id}/status`, {
    // Provide the method field value.
    method: 'PATCH',
    // Provide the body field value.
    body: JSON.stringify({ status }),
  });
}

/**
 * Permanently delete a contact message.
 * @param id - Contact message id
 */
export async function deleteContact(id: string): Promise<{ deleted: boolean; id: number }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/contacts/${id}`, { method: 'DELETE' });
}
