import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { API_URL } from './test-env';
import type { AllocatedFutureRange } from './dates';
import type { ApiSession } from './csrf';

type GuestHoldRaceResult = {
  status: number;
  body: any;
  session: ApiSession;
};

async function postGuestOrderOnce(
  carId: number,
  range: AllocatedFutureRange
): Promise<GuestHoldRaceResult & { dispose: () => Promise<void> }> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_URL });
  try {
    const csrfRes = await ctx.get('/api/v1/auth/csrf');
    const csrfBody = await csrfRes.json();
    const csrfToken = csrfBody.data?.csrfToken as string;
    if (!csrfToken) throw new Error('postGuestOrderOnce: missing csrf');

    const state = await ctx.storageState();
    const cookieHeader = state.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await ctx.post('/api/orders', {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        Cookie: cookieHeader,
      },
      data: {
        carId,
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        pickupLocation: 'office',
        returnLocation: 'office',
      },
    });

    const body = await res.json().catch(() => null);
    const after = await ctx.storageState();
    const afterCookies = after.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    return {
      status: res.status(),
      body,
      session: { csrfToken, cookieHeader: afterCookies || cookieHeader },
      dispose: async () => ctx.dispose(),
    };
  } catch (err) {
    await ctx.dispose();
    throw err;
  }
}

/** Parallel guest POST /api/orders — expects one 200 and one 409 CONFLICT. */
export async function raceGuestHoldsViaApi(
  _request: APIRequestContext,
  carId: number,
  range: AllocatedFutureRange
): Promise<{ winner: GuestHoldRaceResult; loser: GuestHoldRaceResult }> {
  const [a, b] = await Promise.all([
    postGuestOrderOnce(carId, range),
    postGuestOrderOnce(carId, range),
  ]);

  try {
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    if (statuses[0] !== 200 || statuses[1] !== 409) {
      throw new Error(
        `raceGuestHoldsViaApi: expected 200+409, got ${a.status}/${b.status}: ${JSON.stringify({
          a: a.body,
          b: b.body,
        })}`
      );
    }
    const winner = a.status === 200 ? a : b;
    const loser = a.status === 409 ? a : b;
    return {
      winner: { status: winner.status, body: winner.body, session: winner.session },
      loser: { status: loser.status, body: loser.body, session: loser.session },
    };
  } finally {
    await a.dispose();
    await b.dispose();
  }
}
