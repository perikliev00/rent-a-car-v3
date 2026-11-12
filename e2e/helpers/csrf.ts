// Contribute this line to the enclosing declaration or statement.
import type { APIRequestContext, APIResponse } from '@playwright/test';
// Import named exports from './test-env'.
import { API_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from './test-env';
// Import named exports from './db'.
import { insertTestAdmin } from './db';

// Export the api session type.
export type ApiSession = {
  // Provide the csrf token field value.
  csrfToken: string;
  // Provide the cookie header field value.
  cookieHeader: string;
};

// Define the normalizeSetCookie function.
function normalizeSetCookie(setCookie: string | string[] | undefined): string[] {
  // Evaluate the condition and enter the branch when it is true.
  if (!setCookie) return [];
  // Evaluate the condition and enter the branch when it is true.
  if (Array.isArray(setCookie)) {
    // Return the resulting value to the caller.
    return setCookie.map((c) => c.split(';')[0].trim()).filter(Boolean);
  }
  // Node may join multiple Set-Cookie with comma; prefer first segment per cookie pair.
  return setCookie
    // Call .split to perform this step.
    .split(/,(?=\s*[^;=\s]+=)/)
    // Call .map to perform this step.
    .map((c) => c.split(';')[0].trim())
    // Call .filter to perform this step.
    .filter(Boolean);
}

// Define the mergeCookieHeader function.
function mergeCookieHeader(existing: string, setCookieHeader: string | string[] | undefined): string {
  // Create the jar constant.
  const jar = new Map<string, string>();
  // Iterate using the loop initializer, condition, and step.
  for (const part of existing.split(';').map((p) => p.trim()).filter(Boolean)) {
    // Create the eq constant.
    const eq = part.indexOf('=');
    // Evaluate the condition and enter the branch when it is true.
    if (eq > 0) {
      // Call jar.set to perform this step.
      jar.set(part.slice(0, eq), part.slice(eq + 1));
    }
  }
  // Iterate using the loop initializer, condition, and step.
  for (const pair of normalizeSetCookie(setCookieHeader)) {
    // Create the eq constant.
    const eq = pair.indexOf('=');
    // Evaluate the condition and enter the branch when it is true.
    if (eq > 0) {
      // Call jar.set to perform this step.
      jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
  // Return the resulting value to the caller.
  return Array.from(jar.entries())
    // Call .map to perform this step.
    .map(([k, v]) => `${k}=${v}`)
    // Call .join to perform this step.
    .join('; ');
}

// Export the async createApiContext function.
export async function createApiContext(request: APIRequestContext): Promise<ApiSession> {
  // Create the csrf res constant.
  const csrfRes = await request.get(`${API_URL}/api/v1/auth/csrf`);
  // Create the csrf body constant.
  const csrfBody = await csrfRes.json();
  // Create the csrf token constant.
  const csrfToken = csrfBody.data?.csrfToken as string;
  // Create the set cookie constant.
  const setCookie = csrfRes.headers()['set-cookie'];
  // Create the cookie header constant.
  const cookieHeader = mergeCookieHeader('', setCookie);

  // Return the resulting value to the caller.
  return { csrfToken, cookieHeader };
}

// Export the async loginApi function.
export async function loginApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the credentials field value.
  credentials: { email: string; password: string }
// Continue the surrounding logic with this statement.
): Promise<ApiSession> {
  // Create the attempt constant.
  const attempt = async (): Promise<{ res: APIResponse; session: ApiSession }> => {
    // Create the session constant.
    const session = await createApiContext(request);
    // Create the login res constant.
    const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
      // Provide the headers field value.
      headers: {
        // Supply the literal value used by the enclosing expression.
        'Content-Type': 'application/json',
        // Supply the literal value used by the enclosing expression.
        'X-CSRF-Token': session.csrfToken,
        // Provide the cookie field value.
        Cookie: session.cookieHeader,
      },
      // Provide the data field value.
      data: {
        // Provide the email field value.
        email: credentials.email,
        // Provide the password field value.
        password: credentials.password,
      },
    });
    // Return the resulting value to the caller.
    return { res: loginRes, session };
  };

  // Destructure object properties into local variables.
  let { res: loginRes, session } = await attempt();

  // Evaluate the condition and enter the branch when it is true.
  if (!loginRes.ok() && loginRes.status() === 409) {
    // Shared Playwright request jar may already hold another user session.
    await request
      // Call .post to perform this step.
      .post(`${API_URL}/api/v1/auth/logout`, {
        // Provide the headers field value.
        headers: {
          // Supply the literal value used by the enclosing expression.
          'X-CSRF-Token': session.csrfToken,
          // Provide the cookie field value.
          Cookie: session.cookieHeader,
        },
      })
      // Call .catch to perform this step.
      .catch(() => undefined);
    // Continue the surrounding logic with this statement.
    ({ res: loginRes, session } = await attempt());
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!loginRes.ok()) {
    // Create the body constant.
    const body = await loginRes.text();
    // Throw an error to stop the current control flow.
    throw new Error(`loginApi failed (${loginRes.status()}): ${body}`);
  }

  // Create the login body constant.
  const loginBody = await loginRes.json();
  // Create the csrf token constant.
  const csrfToken = (loginBody.data?.csrfToken as string) || session.csrfToken;
  // Create the cookie header constant.
  const cookieHeader = mergeCookieHeader(session.cookieHeader, loginRes.headers()['set-cookie']);

  // Return the resulting value to the caller.
  return { csrfToken, cookieHeader };
}

// Export the async loginAsAdmin function.
export async function loginAsAdmin(request: APIRequestContext): Promise<ApiSession> {
  // Wait until the asynchronous operation resolves.
  await insertTestAdmin();
  // Return the resulting value to the caller.
  return loginApi(request, {
    // Provide the email field value.
    email: ADMIN_EMAIL,
    // Provide the password field value.
    password: ADMIN_PASSWORD,
  });
}

// Define the authHeaders function.
function authHeaders(session: ApiSession, includeJson = false): Record<string, string> {
  // Continue the surrounding logic with this statement.
  const headers: Record<string, string> = {
    // Supply the literal value used by the enclosing expression.
    'X-CSRF-Token': session.csrfToken,
    // Provide the cookie field value.
    Cookie: session.cookieHeader,
  };
  // Evaluate the condition and enter the branch when it is true.
  if (includeJson) {
    // Continue the surrounding logic with this statement.
    headers['Content-Type'] = 'application/json';
  }
  // Return the resulting value to the caller.
  return headers;
}

// Export the async apiPost function.
export async function apiPost(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the path field value.
  path: string,
  // Provide the data field value.
  data: unknown,
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<APIResponse> {
  // Create the auth constant.
  const auth = session || (await createApiContext(request));
  // Return the resulting value to the caller.
  return request.post(`${API_URL}${path}`, {
    // Provide the headers field value.
    headers: authHeaders(auth, true),
    // Contribute this line to the enclosing declaration or statement.
    data,
  });
}

// Export the async apiGet function.
export async function apiGet(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the path field value.
  path: string,
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<APIResponse> {
  // Create the auth constant.
  const auth = session || (await createApiContext(request));
  // Return the resulting value to the caller.
  return request.get(`${API_URL}${path}`, {
    // Provide the headers field value.
    headers: authHeaders(auth),
  });
}

// Export the async apiPatch function.
export async function apiPatch(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the path field value.
  path: string,
  // Provide the data field value.
  data: unknown,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<APIResponse> {
  // Return the resulting value to the caller.
  return request.patch(`${API_URL}${path}`, {
    // Provide the headers field value.
    headers: authHeaders(session, true),
    // Contribute this line to the enclosing declaration or statement.
    data,
  });
}

// Export the async apiDelete function.
export async function apiDelete(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the path field value.
  path: string,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<APIResponse> {
  // Return the resulting value to the caller.
  return request.delete(`${API_URL}${path}`, {
    // Provide the headers field value.
    headers: authHeaders(session),
  });
}

// Export the async apiPut function.
export async function apiPut(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the path field value.
  path: string,
  // Provide the data field value.
  data: unknown,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<APIResponse> {
  // Return the resulting value to the caller.
  return request.put(`${API_URL}${path}`, {
    // Provide the headers field value.
    headers: authHeaders(session, true),
    // Contribute this line to the enclosing declaration or statement.
    data,
  });
}

/** Apply sid/csrf cookies from an API session onto a browser context. */
export function cookiesFromSession(session: ApiSession): Array<{
  // Provide the name field value.
  name: string;
  // Provide the value field value.
  value: string;
  // Provide the url field value.
  url: string;
  // Provide the http only field value.
  httpOnly: boolean;
  // Provide the same site field value.
  sameSite: 'Lax';
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return session.cookieHeader
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
}
