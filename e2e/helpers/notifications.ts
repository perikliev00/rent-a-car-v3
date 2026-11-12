import type { APIRequestContext } from '@playwright/test';
import { apiGet, apiPost, loginAsAdmin, type ApiSession } from './csrf';

export async function listNotificationsViaApi(
  request: APIRequestContext,
  options?: { limit?: number; offset?: number; status?: string },
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any; items: any[] }> {
  const auth = session || (await loginAsAdmin(request));
  const qs = new URLSearchParams();
  if (options?.limit != null) qs.set('limit', String(options.limit));
  if (options?.offset != null) qs.set('offset', String(options.offset));
  if (options?.status) qs.set('status', options.status);
  const path = `/api/admin/notifications${qs.toString() ? `?${qs}` : ''}`;
  const res = await apiGet(request, path, auth);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = { text: await res.text().catch(() => '') };
  }
  const items = body?.data?.rows ?? body?.data?.notifications ?? body?.rows ?? [];
  return {
    ok: res.ok(),
    status: res.status(),
    body,
    items: Array.isArray(items) ? items : [],
  };
}

export async function runNotificationSchedulerViaApi(
  request: APIRequestContext,
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const auth = session || (await loginAsAdmin(request));
  const res = await apiPost(request, '/api/admin/notifications/run-scheduler', {}, auth);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = { text: await res.text().catch(() => '') };
  }
  return { ok: res.ok(), status: res.status(), body };
}
