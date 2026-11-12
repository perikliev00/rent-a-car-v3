/**
 * Public contact-form submission endpoint.
 */
import type { Contact, CreateContactPayload } from '../types/api';
import { api } from './client';

/**
 * Submit a contact inquiry from the public contact page.
 *
 * @param payload - Name, email, message, and any other fields collected by the form.
 * @returns Created contact record echoed from the API.
 * @remarks Side effect: persists the inquiry and may trigger staff notification email.
 */
export async function createContact(
  payload: CreateContactPayload,
): Promise<{ contact: Contact }> {
  return api<{ contact: Contact }>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
