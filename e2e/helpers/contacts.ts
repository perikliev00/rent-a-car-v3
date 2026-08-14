import type { APIRequestContext } from '@playwright/test';
import { API_URL } from './test-env';
import {
  apiDelete,
  apiGet,
  apiPatch,
  createApiContext,
  type ApiSession,
} from './csrf';

export async function createContactViaApi(
  request: APIRequestContext,
  data: { name: string; email: string; subject: string; message: string; phone?: string }
): Promise<{ status: number; body: any; contactId?: number }> {
  const session = await createApiContext(request);
  const res = await request.post(`${API_URL}/api/contacts`, {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookieHeader,
    },
    data,
  });
  const body = await res.json().catch(() => ({}));
  const contact = body?.data?.contact ?? body?.contact;
  return {
    status: res.status(),
    body,
    contactId: contact?.id != null ? Number(contact.id) : undefined,
  };
}

export async function listAdminContactsViaApi(
  request: APIRequestContext,
  session: ApiSession
): Promise<{ status: number; contacts: any[] }> {
  const res = await apiGet(request, '/api/admin/contacts', session);
  const body = await res.json().catch(() => ({}));
  return {
    status: res.status(),
    contacts: body?.data?.contacts ?? body?.contacts ?? [],
  };
}

export async function updateContactStatusViaApi(
  request: APIRequestContext,
  session: ApiSession,
  contactId: number | string,
  status: string
): Promise<{ status: number; body: any }> {
  const res = await apiPatch(
    request,
    `/api/admin/contacts/${contactId}/status`,
    { status },
    session
  );
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

export async function deleteContactViaApi(
  request: APIRequestContext,
  session: ApiSession,
  contactId: number | string
): Promise<{ status: number; body: any }> {
  const res = await apiDelete(request, `/api/admin/contacts/${contactId}`, session);
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

export async function createContactViaPost(
  request: APIRequestContext,
  data: { name: string; email: string; subject: string; message: string }
): Promise<{ status: number; body: any }> {
  // Public contact may need CSRF — prefer form UI; this is a fallback.
  return createContactViaApi(request, data);
}
