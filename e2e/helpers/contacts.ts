// Contribute this line to the enclosing declaration or statement.
import type { APIRequestContext } from '@playwright/test';
// Import named exports from './test-env'.
import { API_URL } from './test-env';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  apiDelete,
  // Contribute this line to the enclosing declaration or statement.
  apiGet,
  // Contribute this line to the enclosing declaration or statement.
  apiPatch,
  // Contribute this line to the enclosing declaration or statement.
  createApiContext,
  // Declare the ApiSession TypeScript type alias.
  type ApiSession,
// Contribute this line to the enclosing declaration or statement.
} from './csrf';

// Export the async createContactViaApi function.
export async function createContactViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the data field value.
  data: { name: string; email: string; subject: string; message: string; phone?: string }
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any; contactId?: number }> {
  // Create the session constant.
  const session = await createApiContext(request);
  // Create the res constant.
  const res = await request.post(`${API_URL}/api/contacts`, {
    // Provide the headers field value.
    headers: {
      // Supply the literal value used by the enclosing expression.
      'Content-Type': 'application/json',
      // Supply the literal value used by the enclosing expression.
      'X-CSRF-Token': session.csrfToken,
      // Provide the cookie field value.
      Cookie: session.cookieHeader,
    },
    // Contribute this line to the enclosing declaration or statement.
    data,
  });
  // Create the body constant.
  const body = await res.json().catch(() => ({}));
  // Create the contact constant.
  const contact = body?.data?.contact ?? body?.contact;
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: res.status(),
    // Contribute this line to the enclosing declaration or statement.
    body,
    // Provide the contact id field value.
    contactId: contact?.id != null ? Number(contact.id) : undefined,
  };
}

// Export the async listAdminContactsViaApi function.
export async function listAdminContactsViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; contacts: any[] }> {
  // Create the res constant.
  const res = await apiGet(request, '/api/admin/contacts', session);
  // Create the body constant.
  const body = await res.json().catch(() => ({}));
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: res.status(),
    // Provide the contacts field value.
    contacts: body?.data?.contacts ?? body?.contacts ?? [],
  };
}

// Export the async updateContactStatusViaApi function.
export async function updateContactStatusViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the session field value.
  session: ApiSession,
  // Provide the contact id field value.
  contactId: number | string,
  // Provide the status field value.
  status: string
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiPatch(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/contacts/${contactId}/status`,
    // Contribute this line to the enclosing declaration or statement.
    { status },
    // Reference the identifier used by the enclosing expression.
    session
  );
  // Return the resulting value to the caller.
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

// Export the async deleteContactViaApi function.
export async function deleteContactViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the session field value.
  session: ApiSession,
  // Provide the contact id field value.
  contactId: number | string
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiDelete(request, `/api/admin/contacts/${contactId}`, session);
  // Return the resulting value to the caller.
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

// Export the async createContactViaPost function.
export async function createContactViaPost(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the data field value.
  data: { name: string; email: string; subject: string; message: string }
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Public contact may need CSRF — prefer form UI; this is a fallback.
  return createContactViaApi(request, data);
}
