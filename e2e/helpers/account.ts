// Contribute this line to the enclosing declaration or statement.
import type { APIRequestContext, Page } from '@playwright/test';
// Import named exports from '@playwright/test'.
import { expect, request as playwrightRequest } from '@playwright/test';
// Import named exports from './test-env'.
import { API_URL } from './test-env';
// Contribute this line to the enclosing declaration or statement.
import type { ApiSession } from './csrf';

// Export the customer auth type.
export type CustomerAuth = {
  // Provide the email field value.
  email: string;
  // Provide the password field value.
  password: string;
  // Provide the user id field value.
  userId: number;
  // Provide the session field value.
  session: ApiSession;
};

// Define the async function cookieHeaderFromContext.
async function cookieHeaderFromContext(ctx: APIRequestContext): Promise<string> {
  // Create the state constant.
  const state = await ctx.storageState();
  // Return the resulting value to the caller.
  return state.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

/**
 * Signup in an isolated API context so we never mutate the shared Playwright
 * `request` cookie jar (which adminPage / loginAsAdmin also use).
 */
export async function signupCustomer(
  // Provide the request field value.
  _request: APIRequestContext,
  // Provide the credentials field value.
  credentials: { email: string; password: string }
// Continue the surrounding logic with this statement.
): Promise<CustomerAuth> {
  // Create the ctx constant.
  const ctx = await playwrightRequest.newContext({ baseURL: API_URL });
  // Start a try block for operations that may fail.
  try {
    // Create the csrf res constant.
    const csrfRes = await ctx.get('/api/v1/auth/csrf');
    // Create the csrf body constant.
    const csrfBody = await csrfRes.json();
    // Create the csrf token constant.
    const csrfToken = csrfBody.data?.csrfToken as string;
    // Evaluate the condition and enter the branch when it is true.
    if (!csrfToken) {
      // Throw an error to stop the current control flow.
      throw new Error('signupCustomer: missing csrf token');
    }

    // Create the res constant.
    const res = await ctx.post('/api/v1/auth/signup', {
      // Provide the headers field value.
      headers: {
        // Supply the literal value used by the enclosing expression.
        'Content-Type': 'application/json',
        // Supply the literal value used by the enclosing expression.
        'X-CSRF-Token': csrfToken,
      },
      // Provide the data field value.
      data: {
        // Provide the email field value.
        email: credentials.email,
        // Provide the password field value.
        password: credentials.password,
      },
    });

    // Evaluate the condition and enter the branch when it is true.
    if (!res.ok()) {
      // Throw an error to stop the current control flow.
      throw new Error(`signupCustomer failed (${res.status()}): ${await res.text()}`);
    }

    // Create the body constant.
    const body = await res.json();
    // Create the user id constant.
    const userId = Number(body.data?.user?.id);
    // Evaluate the condition and enter the branch when it is true.
    if (!Number.isFinite(userId)) {
      // Throw an error to stop the current control flow.
      throw new Error('signupCustomer: missing user id in response');
    }

    // Create the cookie header constant.
    const cookieHeader = await cookieHeaderFromContext(ctx);
    // Return the resulting value to the caller.
    return {
      // Provide the email field value.
      email: credentials.email,
      // Provide the password field value.
      password: credentials.password,
      // Contribute this line to the enclosing declaration or statement.
      userId,
      // Provide the session field value.
      session: {
        // Provide the csrf token field value.
        csrfToken: (body.data?.csrfToken as string) || csrfToken,
        // Contribute this line to the enclosing declaration or statement.
        cookieHeader,
      },
    };
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Wait until the asynchronous operation resolves.
    await ctx.dispose();
  }
}

// Export the async loginAsCustomer function.
export async function loginAsCustomer(
  // Provide the request field value.
  _request: APIRequestContext,
  // Provide the credentials field value.
  credentials: { email: string; password: string }
// Continue the surrounding logic with this statement.
): Promise<ApiSession> {
  // Create the ctx constant.
  const ctx = await playwrightRequest.newContext({ baseURL: API_URL });
  // Start a try block for operations that may fail.
  try {
    // Create the csrf res constant.
    const csrfRes = await ctx.get('/api/v1/auth/csrf');
    // Create the csrf body constant.
    const csrfBody = await csrfRes.json();
    // Initialize the mutable csrf token variable.
    let csrfToken = csrfBody.data?.csrfToken as string;

    // Create the res constant.
    const res = await ctx.post('/api/v1/auth/login', {
      // Provide the headers field value.
      headers: {
        // Supply the literal value used by the enclosing expression.
        'Content-Type': 'application/json',
        // Supply the literal value used by the enclosing expression.
        'X-CSRF-Token': csrfToken,
      },
      // Provide the data field value.
      data: {
        // Provide the email field value.
        email: credentials.email,
        // Provide the password field value.
        password: credentials.password,
      },
    });

    // Evaluate the condition and enter the branch when it is true.
    if (!res.ok()) {
      // Throw an error to stop the current control flow.
      throw new Error(`loginAsCustomer failed (${res.status()}): ${await res.text()}`);
    }

    // Create the body constant.
    const body = await res.json();
    // Update csrfToken with the right-hand side value.
    csrfToken = (body.data?.csrfToken as string) || csrfToken;
    // Return the resulting value to the caller.
    return {
      // Contribute this line to the enclosing declaration or statement.
      csrfToken,
      // Provide the cookie header field value.
      cookieHeader: await cookieHeaderFromContext(ctx),
    };
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Wait until the asynchronous operation resolves.
    await ctx.dispose();
  }
}

// Export the async signupViaUi function.
export async function signupViaUi(
  // Provide the page field value.
  page: Page,
  // Provide the credentials field value.
  credentials: { email: string; password: string }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await page.goto('/signup');
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Email').fill(credentials.email);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Confirm password').fill(credentials.password);
  // Wait until the asynchronous operation resolves.
  await page.getByRole('main').getByRole('button', { name: /sign up|create account/i }).click();
  // Wait until the asynchronous operation resolves.
  await page.waitForURL(/\/verify-email/, { timeout: 15_000 });
}

// Export the async loginViaUi function.
export async function loginViaUi(
  // Provide the page field value.
  page: Page,
  // Provide the credentials field value.
  credentials: { email: string; password: string }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await page.goto('/login');
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Email').fill(credentials.email);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  // Wait until the asynchronous operation resolves.
  await page.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
  // Wait until the asynchronous operation resolves.
  await page.waitForURL(/\/(account|admin)?\/?$/, { timeout: 15_000 });
}

/** Submit wrong password on /login and wait for an error (does not require navigation). */
export async function submitWrongPasswordViaUi(
  // Provide the page field value.
  page: Page,
  // Provide the credentials field value.
  credentials: { email: string; password?: string }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await page.goto('/login');
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Email').fill(credentials.email);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Password', { exact: true }).fill(credentials.password ?? 'WrongPassword!!!');
  // Wait until the asynchronous operation resolves.
  await page.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
  // Wait until the asynchronous operation resolves.
  await expect(page.locator('p.font-medium').filter({ hasText: /.+/ })).toBeVisible({
    // Provide the timeout field value.
    timeout: 10_000,
  });
}

/** Inject API session cookies so the browser context is authenticated. */
export async function applySessionCookies(page: Page, session: ApiSession): Promise<void> {
  // Create the cookies constant.
  const cookies = session.cookieHeader
    // Call .split to perform this step.
    .split(';')
    // Call .map to perform this step.
    .map((part) => part.trim())
    // Call .filter to perform this step.
    .filter(Boolean)
    // Call .map to perform this step.
    .map((pair) => {
      // Create the eq constant.
      const eq = pair.indexOf('=');
      // Create the name constant.
      const name = eq > 0 ? pair.slice(0, eq) : pair;
      // Create the value constant.
      const value = eq > 0 ? pair.slice(eq + 1) : '';
      // Return the resulting value to the caller.
      return {
        // Contribute this line to the enclosing declaration or statement.
        name,
        // Contribute this line to the enclosing declaration or statement.
        value,
        // Provide the url field value.
        url: API_URL,
        // Provide the http only field value.
        httpOnly: name === 'sid',
        // Provide the same site field value.
        sameSite: 'Lax' as const,
      };
    });
  // Evaluate the condition and enter the branch when it is true.
  if (cookies.length) {
    // Wait until the asynchronous operation resolves.
    await page.context().addCookies(cookies);
  }
}

// Export the async createOwnedHoldViaApi function.
export async function createOwnedHoldViaApi(
  // Provide the request field value.
  _request: APIRequestContext,
  // Provide the session field value.
  session: ApiSession,
  // Provide the body field value.
  body: Record<string, unknown>
// Continue the surrounding logic with this statement.
): Promise<{ reservationId?: number }> {
  // Create the ctx constant.
  const ctx = await playwrightRequest.newContext({
    // Provide the base url field value.
    baseURL: API_URL,
    // Provide the extra httpheaders field value.
    extraHTTPHeaders: {
      // Provide the cookie field value.
      Cookie: session.cookieHeader,
      // Supply the literal value used by the enclosing expression.
      'X-CSRF-Token': session.csrfToken,
    },
  });
  // Start a try block for operations that may fail.
  try {
    // Create the res constant.
    const res = await ctx.post('/api/v1/orders', {
      // Provide the headers field value.
      headers: { 'Content-Type': 'application/json' },
      // Provide the data field value.
      data: body,
    });
    // Evaluate the condition and enter the branch when it is true.
    if (!res.ok()) {
      // Throw an error to stop the current control flow.
      throw new Error(`createOwnedHoldViaApi failed (${res.status()}): ${await res.text()}`);
    }
    // Create the json constant.
    const json = await res.json();
    // Return the resulting value to the caller.
    return {
      // Provide the reservation id field value.
      reservationId: json.data?.reservation?.id ? Number(json.data.reservation.id) : undefined,
    };
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Wait until the asynchronous operation resolves.
    await ctx.dispose();
  }
}
