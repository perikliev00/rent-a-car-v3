import type { APIRequestContext, Page } from '@playwright/test';
import { expect, request as playwrightRequest } from '@playwright/test';
import { API_URL } from './test-env';
import type { ApiSession } from './csrf';

export type CustomerAuth = {
  email: string;
  password: string;
  userId: number;
  session: ApiSession;
};

async function cookieHeaderFromContext(ctx: APIRequestContext): Promise<string> {
  const state = await ctx.storageState();
  return state.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

/**
 * Signup in an isolated API context so we never mutate the shared Playwright
 * `request` cookie jar (which adminPage / loginAsAdmin also use).
 */
export async function signupCustomer(
  _request: APIRequestContext,
  credentials: { email: string; password: string }
): Promise<CustomerAuth> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_URL });
  try {
    const csrfRes = await ctx.get('/api/v1/auth/csrf');
    const csrfBody = await csrfRes.json();
    const csrfToken = csrfBody.data?.csrfToken as string;
    if (!csrfToken) {
      throw new Error('signupCustomer: missing csrf token');
    }

    const res = await ctx.post('/api/v1/auth/signup', {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      data: {
        email: credentials.email,
        password: credentials.password,
      },
    });

    if (!res.ok()) {
      throw new Error(`signupCustomer failed (${res.status()}): ${await res.text()}`);
    }

    const body = await res.json();
    const userId = Number(body.data?.user?.id);
    if (!Number.isFinite(userId)) {
      throw new Error('signupCustomer: missing user id in response');
    }

    const cookieHeader = await cookieHeaderFromContext(ctx);
    return {
      email: credentials.email,
      password: credentials.password,
      userId,
      session: {
        csrfToken: (body.data?.csrfToken as string) || csrfToken,
        cookieHeader,
      },
    };
  } finally {
    await ctx.dispose();
  }
}

export async function loginAsCustomer(
  _request: APIRequestContext,
  credentials: { email: string; password: string }
): Promise<ApiSession> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_URL });
  try {
    const csrfRes = await ctx.get('/api/v1/auth/csrf');
    const csrfBody = await csrfRes.json();
    let csrfToken = csrfBody.data?.csrfToken as string;

    const res = await ctx.post('/api/v1/auth/login', {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      data: {
        email: credentials.email,
        password: credentials.password,
      },
    });

    if (!res.ok()) {
      throw new Error(`loginAsCustomer failed (${res.status()}): ${await res.text()}`);
    }

    const body = await res.json();
    csrfToken = (body.data?.csrfToken as string) || csrfToken;
    return {
      csrfToken,
      cookieHeader: await cookieHeaderFromContext(ctx),
    };
  } finally {
    await ctx.dispose();
  }
}

export async function signupViaUi(
  page: Page,
  credentials: { email: string; password: string }
): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByLabel('Confirm password').fill(credentials.password);
  await page.getByRole('main').getByRole('button', { name: /sign up|create account/i }).click();
  await page.waitForURL(/\/$/, { timeout: 15_000 });
}

export async function loginViaUi(
  page: Page,
  credentials: { email: string; password: string }
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/(account|admin)?\/?$/, { timeout: 15_000 });
}

/** Submit wrong password on /login and wait for an error (does not require navigation). */
export async function submitWrongPasswordViaUi(
  page: Page,
  credentials: { email: string; password?: string }
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password ?? 'WrongPassword!!!');
  await page.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
  await expect(page.locator('p.font-medium').filter({ hasText: /.+/ })).toBeVisible({
    timeout: 10_000,
  });
}

/** Inject API session cookies so the browser context is authenticated. */
export async function applySessionCookies(page: Page, session: ApiSession): Promise<void> {
  const cookies = session.cookieHeader
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
  if (cookies.length) {
    await page.context().addCookies(cookies);
  }
}

export async function createOwnedHoldViaApi(
  _request: APIRequestContext,
  session: ApiSession,
  body: Record<string, unknown>
): Promise<{ reservationId?: number }> {
  const ctx = await playwrightRequest.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: {
      Cookie: session.cookieHeader,
      'X-CSRF-Token': session.csrfToken,
    },
  });
  try {
    const res = await ctx.post('/api/v1/orders', {
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });
    if (!res.ok()) {
      throw new Error(`createOwnedHoldViaApi failed (${res.status()}): ${await res.text()}`);
    }
    const json = await res.json();
    return {
      reservationId: json.data?.reservation?.id ? Number(json.data.reservation.id) : undefined,
    };
  } finally {
    await ctx.dispose();
  }
}
