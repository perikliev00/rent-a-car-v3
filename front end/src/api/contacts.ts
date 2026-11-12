/**
 * Public contact-form submission endpoint.
 */
import type { Contact, CreateContactPayload } from '../types/api';
// Import named exports from './client'.
import { api } from './client';

/**
 * Submit a contact inquiry from the public contact page.
 *
 * @param payload - Name, email, message, and any other fields collected by the form.
 * @returns Created contact record echoed from the API.
 * @remarks Side effect: persists the inquiry and may trigger staff notification email.
 */
export async function createContact(
  // Provide the payload field value.
  payload: CreateContactPayload,
// Continue the surrounding logic with this statement.
): Promise<{ contact: Contact }> {
  // Return the resulting value to the caller.
  return api<{ contact: Contact }>('/api/contacts', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(payload),
  });
}
