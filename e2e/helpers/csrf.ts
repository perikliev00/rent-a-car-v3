import type { APIRequestContext, APIResponse } from '@playwright/test';
import { API_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from './test-env';
import { insertTestAdmin } from './db';

export type ApiSession = {
  csrfToken: string;
  cookieHeader: string;
};

function normalizeSetCookie(setCookie: string | string[] | undefined): string[] {
  if (!setCookie) return [];
  if (Array.isArray(setCookie)) {
    return setCookie.map((c) => c.split(';')[0].trim()).filter(Boolean);
  }
  // Node may join multiple Set-Cookie with comma; prefer first segment per cookie pair.
  return setCookie
    .split(/,(?=\s*[^;=\s]+=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean);
}

function mergeCookieHeader(existing: string, setCookieHeader: string | string[] | undefined): string {
  const jar = new Map<string, string>();
  for (const part of existing.split(';').map((p) => p.trim()).filter(Boolean)) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      jar.set(part.slice(0, eq), part.slice(eq + 1));
    }
  }
  for (const pair of normalizeSetCookie(setCookieHeader)) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export async function createApiContext(request: APIRequestContext): Promise<ApiSession> {
  const csrfRes = await request.get(`${API_URL}/api/v1/auth/csrf`);
  const csrfBody = await csrfRes.json();
  const csrfToken = csrfBody.data?.csrfToken as string;
  const setCookie = csrfRes.headers()['set-cookie'];
  const cookieHeader = mergeCookieHeader('', setCookie);

  return { csrfToken, cookieHeader };
}

export async function loginApi(
  request: APIRequestContext,
  credentials: { email: string; password: string }
): Promise<ApiSession> {
  const attempt = async (): Promise<{ res: APIResponse; session: ApiSession }> => {
    const session = await createApiContext(request);
    const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': session.csrfToken,
        Cookie: session.cookieHeader,
      },
      data: {
        email: credentials.email,
        password: credentials.password,
      },
    });
    return { res: loginRes, session };
  };

  let { res: loginRes, session } = await attempt();

  if (!loginRes.ok() && loginRes.status() === 409) {
    // Shared Playwright request jar may already hold another user session.
    await request
      .post(`${API_URL}/api/v1/auth/logout`, {
        headers: {
          'X-CSRF-Token': session.csrfToken,
          Cookie: session.cookieHeader,
        },
      })
      .catch(() => undefined);
    ({ res: loginRes, session } = await attempt());
  }

  if (!loginRes.ok()) {
    const body = await loginRes.text();
    throw new Error(`loginApi failed (${loginRes.status()}): ${body}`);
  }

  const loginBody = await loginRes.json();
  const csrfToken = (loginBody.data?.csrfToken as string) || session.csrfToken;
  const cookieHeader = mergeCookieHeader(session.cookieHeader, loginRes.headers()['set-cookie']);

  return { csrfToken, cookieHeader };
}

export async function loginAsAdmin(request: APIRequestContext): Promise<ApiSession> {
  await insertTestAdmin();
  return loginApi(request, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
}

function authHeaders(session: ApiSession, includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {
    'X-CSRF-Token': session.csrfToken,
    Cookie: session.cookieHeader,
  };
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export async function apiPost(
  request: APIRequestContext,
  path: string,
  data: unknown,
  session?: ApiSession
): Promise<APIResponse> {
  const auth = session || (await createApiContext(request));
  return request.post(`${API_URL}${path}`, {
    headers: authHeaders(auth, true),
    data,
  });
}

export async function apiGet(
  request: APIRequestContext,
  path: string,
  session?: ApiSession
): Promise<APIResponse> {
  const auth = session || (await createApiContext(request));
  return request.get(`${API_URL}${path}`, {
    headers: authHeaders(auth),
  });
}

export async function apiPatch(
  request: APIRequestContext,
  path: string,
  data: unknown,
  session: ApiSession
): Promise<APIResponse> {
  return request.patch(`${API_URL}${path}`, {
    headers: authHeaders(session, true),
    data,
  });
}

export async function apiDelete(
  request: APIRequestContext,
  path: string,
  session: ApiSession
): Promise<APIResponse> {
  return request.delete(`${API_URL}${path}`, {
    headers: authHeaders(session),
  });
}

export async function apiPut(
  request: APIRequestContext,
  path: string,
  data: unknown,
  session: ApiSession
): Promise<APIResponse> {
  return request.put(`${API_URL}${path}`, {
    headers: authHeaders(session, true),
    data,
  });
}

/** Apply sid/csrf cookies from an API session onto a browser context. */
export function cookiesFromSession(session: ApiSession): Array<{
  name: string;
  value: string;
  url: string;
  httpOnly: boolean;
  sameSite: 'Lax';
}> {
  return session.cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      const name = eq > 0 ? pair.slice(0, eq) : pair;
      const value = eq > 0 ? pair.slice(eq + 1) : '';
      return {
        name,
        value,
        url: API_URL,
        httpOnly: name === 'sid',
        sameSite: 'Lax' as const,
      };
    });
}
