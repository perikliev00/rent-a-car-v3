// Contribute this line to the enclosing declaration or statement.
import type { APIRequestContext } from '@playwright/test';
// Import named exports from './csrf'.
import { apiGet, apiPost, type ApiSession } from './csrf';

// Export the async getPaymentsMonitorViaApi function.
export async function getPaymentsMonitorViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiGet(request, '/api/admin/payments', session);
  // Return the resulting value to the caller.
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

// Export the async reconcilePaymentsViaApi function.
export async function reconcilePaymentsViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the session field value.
  session: ApiSession,
  // Provide the dry run field value.
  dryRun: boolean
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiPost(request, '/api/admin/payments/reconcile', { dryRun }, session);
  // Return the resulting value to the caller.
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

// Export the async markStubSessionPaid function.
export async function markStubSessionPaid(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the session field value.
  session: ApiSession,
  // Provide the stripe session id field value.
  stripeSessionId: string
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiPost(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Supply the literal value used by the enclosing expression.
    '/api/admin/payments/stub/mark-paid',
    // Contribute this line to the enclosing declaration or statement.
    { stripeSessionId },
    // Reference the identifier used by the enclosing expression.
    session
  );
  // Return the resulting value to the caller.
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}
