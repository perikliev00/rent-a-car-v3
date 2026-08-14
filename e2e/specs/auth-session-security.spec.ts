import { test, expect, request as playwrightRequest } from '@playwright/test';
import { API_URL } from '../helpers/test-env';
import { uniqueEmail } from '../helpers/test-env';
import { signupCustomer } from '../helpers/account';

test.describe.configure({ mode: 'serial' });

function sidFromCookieHeader(cookieHeader: string): string | null {
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function cookieHeaderFromContext(ctx: Awaited<ReturnType<typeof playwrightRequest.newContext>>) {
  const state = await ctx.storageState();
  return state.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

test.describe('AUTH-006 Auth session security', () => {
  test.setTimeout(120_000);

  test('duplicate signup returns 409 EMAIL_IN_USE', async ({ request }) => {
    const email = uniqueEmail('dup-signup');
    const password = 'Customer123!';
    await signupCustomer(request, { email, password });

    const ctx = await playwrightRequest.newContext({ baseURL: API_URL });
    try {
      const csrfRes = await ctx.get('/api/v1/auth/csrf');
      const csrfToken = (await csrfRes.json()).data?.csrfToken as string;
      const res = await ctx.post('/api/v1/auth/signup', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        data: { email, password },
      });
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.error?.code || body.code).toBe('EMAIL_IN_USE');
    } finally {
      await ctx.dispose();
    }
  });

  test('five bad logins lock the account with 429', async () => {
    const email = uniqueEmail('lockout');
    const ctx = await playwrightRequest.newContext({ baseURL: API_URL });
    try {
      for (let i = 0; i < 5; i += 1) {
        const csrfRes = await ctx.get('/api/v1/auth/csrf');
        const csrfToken = (await csrfRes.json()).data?.csrfToken as string;
        const cookies = await cookieHeaderFromContext(ctx);
        const res = await ctx.post('/api/v1/auth/login', {
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
            Cookie: cookies,
          },
          data: { email, password: 'WrongPassword!!!' },
        });
        // Failures may be 401 until lockout threshold
        expect([401, 429]).toContain(res.status());
      }

      const csrfRes = await ctx.get('/api/v1/auth/csrf');
      const csrfToken = (await csrfRes.json()).data?.csrfToken as string;
      const cookies = await cookieHeaderFromContext(ctx);
      const locked = await ctx.post('/api/v1/auth/login', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          Cookie: cookies,
        },
        data: { email, password: 'WrongPassword!!!' },
      });
      expect(locked.status()).toBe(429);
      const body = await locked.json();
      expect(body.error?.code || body.code).toBe('RATE_LIMITED');
    } finally {
      await ctx.dispose();
    }
  });

  test('login regenerates session sid; logout clears auth', async ({ request }) => {
    const email = uniqueEmail('session-rot');
    const password = 'Customer123!';
    await signupCustomer(request, { email, password });

    const ctx = await playwrightRequest.newContext({ baseURL: API_URL });
    try {
      const csrfRes = await ctx.get('/api/v1/auth/csrf');
      const csrfBody = await csrfRes.json();
      let csrfToken = csrfBody.data?.csrfToken as string;
      const preLoginCookies = await cookieHeaderFromContext(ctx);
      const sidBefore = sidFromCookieHeader(preLoginCookies);
      expect(sidBefore).toBeTruthy();

      const loginRes = await ctx.post('/api/v1/auth/login', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        data: { email, password },
      });
      expect(loginRes.ok(), await loginRes.text()).toBeTruthy();
      const loginBody = await loginRes.json();
      csrfToken = (loginBody.data?.csrfToken as string) || csrfToken;

      const postLoginCookies = await cookieHeaderFromContext(ctx);
      const sidAfter = sidFromCookieHeader(postLoginCookies);
      expect(sidAfter).toBeTruthy();
      expect(sidAfter).not.toBe(sidBefore);

      const me = await ctx.get('/api/v1/auth/me', {
        headers: { 'X-CSRF-Token': csrfToken },
      });
      expect(me.ok()).toBeTruthy();

      const logout = await ctx.post('/api/v1/auth/logout', {
        headers: { 'X-CSRF-Token': csrfToken },
      });
      expect(logout.ok() || logout.status() === 204 || logout.status() === 200).toBeTruthy();

      const meAfter = await ctx.get('/api/v1/auth/me');
      expect(meAfter.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });
});
