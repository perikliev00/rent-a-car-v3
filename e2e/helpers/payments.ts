import type { APIRequestContext } from '@playwright/test';
import { apiGet, apiPost, type ApiSession } from './csrf';

export async function getPaymentsMonitorViaApi(
  request: APIRequestContext,
  session: ApiSession
): Promise<{ status: number; body: any }> {
  const res = await apiGet(request, '/api/admin/payments', session);
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

export async function reconcilePaymentsViaApi(
  request: APIRequestContext,
  session: ApiSession,
  dryRun: boolean
): Promise<{ status: number; body: any }> {
  const res = await apiPost(request, '/api/admin/payments/reconcile', { dryRun }, session);
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

export async function markStubSessionPaid(
  request: APIRequestContext,
  session: ApiSession,
  stripeSessionId: string
): Promise<{ status: number; body: any }> {
  const res = await apiPost(
    request,
    '/api/admin/payments/stub/mark-paid',
    { stripeSessionId },
    session
  );
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}
