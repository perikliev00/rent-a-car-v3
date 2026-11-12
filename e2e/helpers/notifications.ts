// Contribute this line to the enclosing declaration or statement.
import type { APIRequestContext } from '@playwright/test';
// Import named exports from './csrf'.
import { apiGet, apiPost, loginAsAdmin, type ApiSession } from './csrf';

// Export the async listNotificationsViaApi function.
export async function listNotificationsViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Contribute this line to the enclosing declaration or statement.
  options?: { limit?: number; offset?: number; status?: string },
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any; items: any[] }> {
  // Create the auth constant.
  const auth = session || (await loginAsAdmin(request));
  // Create the qs constant.
  const qs = new URLSearchParams();
  // Evaluate the condition and enter the branch when it is true.
  if (options?.limit != null) qs.set('limit', String(options.limit));
  // Evaluate the condition and enter the branch when it is true.
  if (options?.offset != null) qs.set('offset', String(options.offset));
  // Evaluate the condition and enter the branch when it is true.
  if (options?.status) qs.set('status', options.status);
  // Create the path constant.
  const path = `/api/admin/notifications${qs.toString() ? `?${qs}` : ''}`;
  // Create the res constant.
  const res = await apiGet(request, path, auth);
  // Continue the surrounding logic with this statement.
  let body: any = null;
  // Start a try block for operations that may fail.
  try {
    // Store the awaited result in body.
    body = await res.json();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Update body with the right-hand side value.
    body = { text: await res.text().catch(() => '') };
  }
  // Create the items constant.
  const items = body?.data?.rows ?? body?.data?.notifications ?? body?.rows ?? [];
  // Return the resulting value to the caller.
  return {
    // Provide the ok field value.
    ok: res.ok(),
    // Provide the status field value.
    status: res.status(),
    // Contribute this line to the enclosing declaration or statement.
    body,
    // Provide the items field value.
    items: Array.isArray(items) ? items : [],
  };
}

// Export the async runNotificationSchedulerViaApi function.
export async function runNotificationSchedulerViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the auth constant.
  const auth = session || (await loginAsAdmin(request));
  // Create the res constant.
  const res = await apiPost(request, '/api/admin/notifications/run-scheduler', {}, auth);
  // Continue the surrounding logic with this statement.
  let body: any = null;
  // Start a try block for operations that may fail.
  try {
    // Store the awaited result in body.
    body = await res.json();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Update body with the right-hand side value.
    body = { text: await res.text().catch(() => '') };
  }
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body };
}
