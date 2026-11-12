// Import named exports from '@playwright/test'.
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
// Import named exports from './test-env'.
import { API_URL } from './test-env';
// Contribute this line to the enclosing declaration or statement.
import type { AllocatedFutureRange } from './dates';
// Contribute this line to the enclosing declaration or statement.
import type { ApiSession } from './csrf';

// Declare the GuestHoldRaceResult TypeScript type alias.
type GuestHoldRaceResult = {
  // Provide the status field value.
  status: number;
  // Provide the body field value.
  body: any;
  // Provide the session field value.
  session: ApiSession;
};

// Define the async function postGuestOrderOnce.
async function postGuestOrderOnce(
  // Provide the car id field value.
  carId: number,
  // Provide the range field value.
  range: AllocatedFutureRange
// Continue the surrounding logic with this statement.
): Promise<GuestHoldRaceResult & { dispose: () => Promise<void> }> {
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
    if (!csrfToken) throw new Error('postGuestOrderOnce: missing csrf');

    // Create the state constant.
    const state = await ctx.storageState();
    // Create the cookie header constant.
    const cookieHeader = state.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Create the res constant.
    const res = await ctx.post('/api/orders', {
      // Provide the headers field value.
      headers: {
        // Supply the literal value used by the enclosing expression.
        'Content-Type': 'application/json',
        // Supply the literal value used by the enclosing expression.
        'X-CSRF-Token': csrfToken,
        // Provide the cookie field value.
        Cookie: cookieHeader,
      },
      // Provide the data field value.
      data: {
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
      },
    });

    // Create the body constant.
    const body = await res.json().catch(() => null);
    // Create the after constant.
    const after = await ctx.storageState();
    // Create the after cookies constant.
    const afterCookies = after.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Return the resulting value to the caller.
    return {
      // Provide the status field value.
      status: res.status(),
      // Contribute this line to the enclosing declaration or statement.
      body,
      // Provide the session field value.
      session: { csrfToken, cookieHeader: afterCookies || cookieHeader },
      // Provide the dispose field value.
      dispose: async () => ctx.dispose(),
    };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await ctx.dispose();
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/** Parallel guest POST /api/orders — expects one 200 and one 409 CONFLICT. */
export async function raceGuestHoldsViaApi(
  // Provide the request field value.
  _request: APIRequestContext,
  // Provide the car id field value.
  carId: number,
  // Provide the range field value.
  range: AllocatedFutureRange
// Continue the surrounding logic with this statement.
): Promise<{ winner: GuestHoldRaceResult; loser: GuestHoldRaceResult }> {
  // Destructure array values into local variables.
  const [a, b] = await Promise.all([
    // Call postGuestOrderOnce to perform this step.
    postGuestOrderOnce(carId, range),
    // Call postGuestOrderOnce to perform this step.
    postGuestOrderOnce(carId, range),
  ]);

  // Start a try block for operations that may fail.
  try {
    // Create the statuses constant.
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    // Evaluate the condition and enter the branch when it is true.
    if (statuses[0] !== 200 || statuses[1] !== 409) {
      // Throw an error to stop the current control flow.
      throw new Error(
        // Continue the surrounding logic with this statement.
        `raceGuestHoldsViaApi: expected 200+409, got ${a.status}/${b.status}: ${JSON.stringify({
          // Provide the a field value.
          a: a.body,
          // Provide the b field value.
          b: b.body,
        // Continue the surrounding logic with this statement.
        })}`
      );
    }
    // Create the winner constant.
    const winner = a.status === 200 ? a : b;
    // Create the loser constant.
    const loser = a.status === 409 ? a : b;
    // Return the resulting value to the caller.
    return {
      // Provide the winner field value.
      winner: { status: winner.status, body: winner.body, session: winner.session },
      // Provide the loser field value.
      loser: { status: loser.status, body: loser.body, session: loser.session },
    };
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Wait until the asynchronous operation resolves.
    await a.dispose();
    // Wait until the asynchronous operation resolves.
    await b.dispose();
  }
}
