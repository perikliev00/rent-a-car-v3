/**
 * H1: checkout cancel must target a specific Stripe attempt owned by the browser
 * session, expire that Checkout session, and leave newer attempts untouched.
 */
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  createTwoSessionAgents,
  postOrder,
  postCheckout,
  postCheckoutCancel,
  postRelease,
} = require('../helpers/sessionAgentFactory');
const {
  buildCheckoutCompletedEvent,
  postSignedWebhook,
} = require('../helpers/stripeWebhookFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  buildCheckoutBody,
  getReservationByStripeSessionId,
  getReservationById,
} = require('../helpers/dbFixtures');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

describeIf('H1: checkout cancel session scope', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Cancel Scope Car', price: 50 });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  async function startCheckout(agent, email) {
    const body = buildCheckoutBody(carId, { email });
    expect((await postOrder(agent, body)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, body);
    expect(checkoutRes.status).toBe(200);
    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation).toBeTruthy();
    expect(reservation.status).toBe('processing_payment');
    return { body, stripeSessionId, reservation };
  }

  test('cancel expires Stripe session A and releases hold A', async () => {
    const agent = await createSessionAgent(app);
    const { stripeSessionId, reservation } = await startCheckout(
      agent,
      `cancel-a-${Date.now()}@example.com`
    );

    const cancelRes = await postCheckoutCancel(agent, { sessionId: stripeSessionId });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.cancelled).toBe(true);

    const stripeSession = stripeTestStub.retrieveSession(stripeSessionId);
    expect(stripeSession.status).toBe('expired');

    const after = await getReservationById(reservation.id);
    expect(after.status).toBe('cancelled');
  });

  test('cancel for attempt A does not release newer checkout B in same browser', async () => {
    const agent = await createSessionAgent(app);
    const bodyA = buildCheckoutBody(carId, {
      email: `cancel-ab-a-${Date.now()}@example.com`,
      pickupDate: '2034-01-10',
      returnDate: '2034-01-13',
    });
    expect((await postOrder(agent, bodyA)).status).toBe(200);
    const checkoutA = await postCheckout(agent, bodyA);
    expect(checkoutA.status).toBe(200);
    const stripeSessionIdA = extractStripeSessionId(checkoutA);

    // Release A, then start checkout B on other dates in the same browser.
    const bodyB = buildCheckoutBody(carId, {
      email: `cancel-ab-b-${Date.now()}@example.com`,
      pickupDate: '2034-02-10',
      returnDate: '2034-02-13',
    });
    expect((await postRelease(agent)).status).toBe(200);
    expect((await postOrder(agent, bodyB)).status).toBe(200);
    const checkoutB = await postCheckout(agent, bodyB);
    expect(checkoutB.status).toBe(200);
    const stripeSessionIdB = extractStripeSessionId(checkoutB);
    const reservationBBefore = await getReservationByStripeSessionId(stripeSessionIdB);
    expect(reservationBBefore.status).toBe('processing_payment');
    expect(stripeSessionIdB).not.toBe(stripeSessionIdA);

    // Late cancel for A (Stripe cancel_url still carries A's session_id).
    const cancelA = await postCheckoutCancel(agent, { sessionId: stripeSessionIdA });
    expect(cancelA.status).toBe(200);

    const stripeA = stripeTestStub.retrieveSession(stripeSessionIdA);
    expect(stripeA.status).toBe('expired');

    const stripeB = stripeTestStub.retrieveSession(stripeSessionIdB);
    expect(stripeB.status).toBe('open');
    expect(stripeB.payment_status).toBe('unpaid');

    const reservationB = await getReservationById(reservationBBefore.id);
    expect(reservationB.status).toBe('processing_payment');
    expect(reservationB.stripe_session_id).toBe(stripeSessionIdB);
    expect(Number(reservationB.total_price)).toBe(Number(reservationBBefore.total_price));
  });

  test('foreign browser session cannot cancel another session attempt', async () => {
    const [owner, stranger] = await createTwoSessionAgents(app);
    const attempt = await startCheckout(owner, `cancel-foreign-${Date.now()}@example.com`);

    const cancelRes = await postCheckoutCancel(stranger, {
      sessionId: attempt.stripeSessionId,
    });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.cancelled).toBe(false);

    const stripeSession = stripeTestStub.retrieveSession(attempt.stripeSessionId);
    expect(stripeSession.status).toBe('open');

    const reservation = await getReservationById(attempt.reservation.id);
    expect(reservation.status).toBe('processing_payment');
  });

  test('payment that wins before cancel leaves paid outcome and cancel is safe to retry', async () => {
    const agent = await createSessionAgent(app);
    const { stripeSessionId, reservation } = await startCheckout(
      agent,
      `cancel-race-${Date.now()}@example.com`
    );

    stripeTestStub.markPaid(stripeSessionId, {
      amount_total: Math.round(Number(reservation.total_price) * 100),
      currency: 'eur',
    });

    const cancelRes = await postCheckoutCancel(agent, { sessionId: stripeSessionId });
    expect(cancelRes.status).toBe(200);
    // Cancel must not tear down a paid attempt; UI may report checking / not cancelled.
    expect(cancelRes.body.data.cancelled).toBe(false);
    expect(
      cancelRes.body.data.paymentChecking === true ||
        /check|process|paid|confirm/i.test(String(cancelRes.body.data.message || ''))
    ).toBe(true);

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_cancel_race_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });
    const webhookRes = await postSignedWebhook(app, event);
    expect(webhookRes.status).toBe(200);

    const after = await getReservationById(reservation.id);
    expect(['confirmed', 'paid', 'manual_review']).toContain(after.status);

    const retry = await postCheckoutCancel(agent, { sessionId: stripeSessionId });
    expect(retry.status).toBe(200);
    expect(retry.body.data.cancelled).toBe(false);
  });

  test('POST /api/reservations/release also expires the open Stripe session', async () => {
    const agent = await createSessionAgent(app);
    const { stripeSessionId, reservation } = await startCheckout(
      agent,
      `release-expire-${Date.now()}@example.com`
    );

    const releaseRes = await postRelease(agent);
    expect(releaseRes.status).toBe(200);

    const stripeSession = stripeTestStub.retrieveSession(stripeSessionId);
    expect(stripeSession.status).toBe('expired');

    const after = await getReservationById(reservation.id);
    expect(after.status).toBe('cancelled');
  });
});
