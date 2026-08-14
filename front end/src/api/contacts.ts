import type { Contact, CreateContactPayload } from '../types/api';
import { api } from './client';

export async function createContact(
  payload: CreateContactPayload,
): Promise<{ contact: Contact }> {
  return api<{ contact: Contact }>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
