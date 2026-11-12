// Destructure object properties into local variables.
const { URLSearchParams } = require('node:url');
// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createSessionAgent,
  // Contribute this line to the enclosing declaration or statement.
  loginAsAdmin,
  // Contribute this line to the enclosing declaration or statement.
  postOrder,
  // Contribute this line to the enclosing declaration or statement.
  postCheckout,
  // Contribute this line to the enclosing declaration or statement.
  postAdminReservationRefund,
  // Contribute this line to the enclosing declaration or statement.
  postAdminReservationStatus,
// Continue the surrounding logic with this statement.
} = require('../helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildCheckoutCompletedEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildStripeEvent,
  // Contribute this line to the enclosing declaration or statement.
  postSignedWebhook,
// Continue the surrounding logic with this statement.
} = require('../helpers/stripeWebhookFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
  // Contribute this line to the enclosing declaration or statement.
  insertTestAdmin,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  buildCheckoutBody,
  // Contribute this line to the enclosing declaration or statement.
  getReservationByStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getOrderByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  getDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  getRefundOperationByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  countOrdersForCar,
  // Contribute this line to the enclosing declaration or statement.
  getStatusHistory,
// Continue the surrounding logic with this statement.
} = require('../helpers/dbFixtures');
// Require the '../../../src/services/payment/stripeTestStub' module as stripeTestStub.
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');
// Destructure object properties into local variables.
const { buildIdempotencyKey } = require('../../../src/services/payment/refund/refundPolicy');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Define the extractStripeSessionId function.
function extractStripeSessionId(checkoutRes) {
  // Return the resulting value to the caller.
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

// Call describeIf to perform this step.
describeIf('MONEY-REFUND: reservation refund via Stripe', () => {
  // Reserve the app variable for later assignment.
  let app;
  // Reserve the car id variable for later assignment.
  let carId;

  // Register setup that runs before the tests.
  beforeAll(async () => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
  });

  // Register setup that runs before the tests.
  beforeEach(async () => {
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
    // Store the awaited result in carId.
    carId = await insertIsolatedTestCar({ name: 'Refund Flow Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Define the async function checkoutAndConfirm.
  async function checkoutAndConfirm() {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carId, { email: 'refund-flow@example.com' });
    // Assert that the value matches the intended expectation.
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    // Create the checkout res constant.
    const checkoutRes = await postCheckout(agent, checkoutBody);
    // Assert that the value matches the intended expectation.
    expect(checkoutRes.status).toBe(200);

    // Create the stripe session id constant.
    const stripeSessionId = extractStripeSessionId(checkoutRes);
    // Create the reservation constant.
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    // Create the amount total constant.
    const amountTotal = Math.round(Number(reservation.total_price) * 100);

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: `evt_refund_pay_${reservation.id}_${Date.now()}`,
      // Provide the session id field value.
      sessionId: stripeSessionId,
      // Provide the reservation id field value.
      reservationId: reservation.id,
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the session id meta field value.
      sessionIdMeta: reservation.session_id,
      // Contribute this line to the enclosing declaration or statement.
      amountTotal,
      // Provide the payment intent field value.
      paymentIntent: stripeTestStub.sessions.get(stripeSessionId)?.payment_intent,
    });
    // Assert that the value matches the intended expectation.
    expect((await postSignedWebhook(app, event)).status).toBe(200);

    // Create the confirmed constant.
    const confirmed = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(confirmed.status).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect(confirmed.stripe_payment_intent_id).toBeTruthy();
    // Return the resulting value to the caller.
    return confirmed;
  }

  // Define a single test case and its expectations.
  test('admin refund succeeds: Stripe refund + domain side effects', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(1);

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the res constant.
    const res = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'integration_refund',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    // Assert that the value matches the intended expectation.
    expect(res.body.data.status).toBe('succeeded');

    // Create the refunded constant.
    const refunded = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(refunded.status).toBe('refunded');

    // Create the op constant.
    const op = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(op.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(op.stripe_refund_id).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(stripeTestStub.refunds.has(op.stripe_refund_id)).toBe(true);

    // Create the order constant.
    const order = await getOrderByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(order.is_deleted).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(order.status).toBe('cancelled');
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(0);

    // Create the history constant.
    const history = await getStatusHistory(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(history.some((h) => h.new_status === 'refunded')).toBe(true);

    // Create the search qs constant.
    const searchQs = new URLSearchParams({
      // Supply the literal value used by the enclosing expression.
      'pickup-date': '2030-06-01',
      // Supply the literal value used by the enclosing expression.
      'return-date': '2030-06-05',
      // Supply the literal value used by the enclosing expression.
      'pickup-time': '10:00',
      // Supply the literal value used by the enclosing expression.
      'return-time': '10:00',
      // Supply the literal value used by the enclosing expression.
      'pickup-location': 'office',
      // Supply the literal value used by the enclosing expression.
      'return-location': 'office',
    });
    // Create the search agent constant.
    const searchAgent = await createSessionAgent(app);
    // Create the search constant.
    const search = await searchAgent.get(`/api/cars/search?${searchQs.toString()}`);
    // Assert that the value matches the intended expectation.
    expect(search.status).toBe(200);
    // Create the cars constant.
    const cars = search.body?.data?.cars ?? search.body?.cars ?? [];
    // Assert that the value matches the intended expectation.
    expect(cars.some((c) => Number(c.id) === carId)).toBe(true);
  });

  // Define a single test case and its expectations.
  test('status-only refunded is rejected', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the res constant.
    const res = await postAdminReservationStatus(admin, reservation.id, {
      // Provide the status field value.
      status: 'refunded',
      // Provide the reason field value.
      reason: 'should_fail',
    });
    // Assert that the value matches the intended expectation.
    expect(res.status).toBe(422);
    // Create the still constant.
    const still = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(still.status).toBe('confirmed');
  });

  // Define a single test case and its expectations.
  test('parallel refunds are idempotent (one Stripe refund)', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Create the admin constant.
    const admin = await loginAsAdmin(app);

    // Destructure array values into local variables.
    const [a, b] = await Promise.all([
      // Call postAdminReservationRefund to perform this step.
      postAdminReservationRefund(admin, reservation.id, { reason: 'parallel_a' }),
      // Call postAdminReservationRefund to perform this step.
      postAdminReservationRefund(admin, reservation.id, { reason: 'parallel_b' }),
    ]);

    // Assert that the value matches the intended expectation.
    expect({
      // Provide the a field value.
      a: { status: a.status, body: a.body },
      // Provide the b field value.
      b: { status: b.status, body: b.body },
    // Continue the surrounding logic with this statement.
    }).toMatchObject({
      // Provide the a field value.
      a: { status: 200 },
      // Provide the b field value.
      b: { status: 200 },
    });
    // Assert that the value matches the intended expectation.
    expect([a.body.data.status, b.body.data.status].every((s) => s === 'succeeded')).toBe(true);

    // Assert that the value matches the intended expectation.
    expect(stripeTestStub.refunds.size).toBe(1);
    // Create the op constant.
    const op = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(op.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('refunded');
  });

  // Define a single test case and its expectations.
  test('pending refund then webhook applies domain', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Call stripeTestStub.setNextRefundStatus to perform this step.
    stripeTestStub.setNextRefundStatus('pending');

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the res constant.
    const res = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'pending_then_webhook',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    // Assert that the value matches the intended expectation.
    expect(res.body.data.status).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('confirmed');

    // Create the op constant.
    const op = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(op.status).toBe('pending');
    // Call stripeTestStub.setRefundState to perform this step.
    stripeTestStub.setRefundState(op.stripe_refund_id, { status: 'succeeded' });

    // Create the event constant.
    const event = buildStripeEvent({
      // Provide the event id field value.
      eventId: `evt_refund_updated_${op.id}_${Date.now()}`,
      // Provide the type field value.
      type: 'refund.updated',
      // Provide the object field value.
      object: {
        // Provide the id field value.
        id: op.stripe_refund_id,
        // Provide the object field value.
        object: 'refund',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the payment intent field value.
        payment_intent: reservation.stripe_payment_intent_id,
        // Provide the amount field value.
        amount: op.amount_cents,
        // Provide the currency field value.
        currency: 'eur',
      },
    });
    // Assert that the value matches the intended expectation.
    expect((await postSignedWebhook(app, event)).status).toBe(200);

    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('refunded');
    // Assert that the value matches the intended expectation.
    expect((await getRefundOperationByReservationId(reservation.id)).status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(0);
  });

  // Define a single test case and its expectations.
  test('partial charge.refunded does not apply domain refund', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Call stripeTestStub.setNextRefundStatus to perform this step.
    stripeTestStub.setNextRefundStatus('pending');

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the res constant.
    const res = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'partial_charge_refunded',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    // Assert that the value matches the intended expectation.
    expect(res.body.data.status).toBe('pending');

    // Create the op constant.
    const op = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(op.status).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);

    // Create the event constant.
    const event = buildStripeEvent({
      // Provide the event id field value.
      eventId: `evt_charge_refunded_partial_${op.id}_${Date.now()}`,
      // Provide the type field value.
      type: 'charge.refunded',
      // Provide the object field value.
      object: {
        // Provide the id field value.
        id: 'ch_partial_1',
        // Provide the object field value.
        object: 'charge',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refunded field value.
        refunded: false,
        // Provide the amount field value.
        amount: op.amount_cents,
        // Provide the amount refunded field value.
        amount_refunded: Math.max(1, Math.floor(Number(op.amount_cents) / 4)),
        // Provide the currency field value.
        currency: 'eur',
        // Provide the payment intent field value.
        payment_intent: reservation.stripe_payment_intent_id,
      },
    });
    // Assert that the value matches the intended expectation.
    expect((await postSignedWebhook(app, event)).status).toBe(200);

    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect((await getRefundOperationByReservationId(reservation.id)).status).not.toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
  });

  // Define a single test case and its expectations.
  test('pending refund blocks pickup to picked_up', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Create the admin constant.
    const admin = await loginAsAdmin(app);

    // Create the prepared constant.
    const prepared = await postAdminReservationStatus(admin, reservation.id, {
      // Provide the status field value.
      status: 'car_prepared',
      // Provide the reason field value.
      reason: 'ready_for_refund_race',
    });
    // Assert that the value matches the intended expectation.
    expect(prepared.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('car_prepared');

    // Call stripeTestStub.setNextRefundStatus to perform this step.
    stripeTestStub.setNextRefundStatus('pending');
    // Create the refund res constant.
    const refundRes = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'refund_vs_pickup',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: refundRes.status, body: refundRes.body }).toMatchObject({ status: 200 });
    // Assert that the value matches the intended expectation.
    expect(refundRes.body.data.status).toBe('pending');

    // Create the pickup constant.
    const pickup = await postAdminReservationStatus(admin, reservation.id, {
      // Provide the status field value.
      status: 'picked_up',
      // Provide the reason field value.
      reason: 'should_block',
    });
    // Assert that the value matches the intended expectation.
    expect(pickup.status).toBe(409);
    // Assert that the value matches the intended expectation.
    expect(pickup.body.error.code).toBe('REFUND_IN_PROGRESS');
    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('car_prepared');
    // Assert that the value matches the intended expectation.
    expect((await getRefundOperationByReservationId(reservation.id)).status).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
  });

  // Define a single test case and its expectations.
  test('pending refund blocks admin cancel', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Call stripeTestStub.setNextRefundStatus to perform this step.
    stripeTestStub.setNextRefundStatus('pending');

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the refund res constant.
    const refundRes = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'refund_vs_cancel',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: refundRes.status, body: refundRes.body }).toMatchObject({ status: 200 });
    // Assert that the value matches the intended expectation.
    expect(refundRes.body.data.status).toBe('pending');

    // Create the cancel constant.
    const cancel = await postAdminReservationStatus(admin, reservation.id, {
      // Provide the status field value.
      status: 'cancelled',
      // Provide the reason field value.
      reason: 'should_block',
    });
    // Assert that the value matches the intended expectation.
    expect(cancel.status).toBe(409);
    // Assert that the value matches the intended expectation.
    expect(cancel.body.error.code).toBe('REFUND_IN_PROGRESS');
    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect((await getRefundOperationByReservationId(reservation.id)).status).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
  });

  // Define a single test case and its expectations.
  test('Stripe fail leaves reservation unchanged', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Call stripeTestStub.failNextCreateRefund to perform this step.
    stripeTestStub.failNextCreateRefund();

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the res constant.
    const res = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'force_fail',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 502 });

    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    // Create the op constant.
    const op = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(op.status).toBe('failed');
  });

  // Define a single test case and its expectations.
  test('failed admin refund then retry uses attempt2, not :full', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Call stripeTestStub.failNextCreateRefund to perform this step.
    stripeTestStub.failNextCreateRefund();

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the first constant.
    const first = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'force_fail_then_retry',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: first.status, body: first.body }).toMatchObject({ status: 502 });
    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);

    // Create the failed op constant.
    const failedOp = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(failedOp.status).toBe('failed');
    // Assert that the value matches the intended expectation.
    expect(failedOp.stripe_refund_id).toBeFalsy();
    // Assert that the value matches the intended expectation.
    expect(failedOp.idempotency_key).toBe(buildIdempotencyKey(reservation.id, 1));

    // Create the second constant.
    const second = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'retry_after_confirmed_fail',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: second.status, body: second.body }).toMatchObject({ status: 200 });

    // Create the latest constant.
    const latest = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(latest.idempotency_key).toBe(buildIdempotencyKey(reservation.id, 2));
    // Assert that the value matches the intended expectation.
    expect(latest.idempotency_key).not.toBe(buildIdempotencyKey(reservation.id, 1));
    // Assert that the value matches the intended expectation.
    expect(latest.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(stripeTestStub.refunds.size).toBe(1);
    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('refunded');
  });

  // Define a single test case and its expectations.
  test('concurrent succeeded and failed HTTP webhooks never leave refunded+failed', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Call stripeTestStub.setNextRefundStatus to perform this step.
    stripeTestStub.setNextRefundStatus('pending');

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the res constant.
    const res = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'concurrent_http_webhooks',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    // Assert that the value matches the intended expectation.
    expect(res.body.data.status).toBe('pending');

    // Create the op constant.
    const op = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(op.status).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(op.stripe_refund_id).toBeTruthy();

    // Create the refund object constant.
    const refundObject = {
      // Provide the id field value.
      id: op.stripe_refund_id,
      // Provide the object field value.
      object: 'refund',
      // Provide the payment intent field value.
      payment_intent: reservation.stripe_payment_intent_id,
      // Provide the amount field value.
      amount: op.amount_cents,
      // Provide the currency field value.
      currency: 'eur',
    };

    // Destructure array values into local variables.
    const [succeededRes, failedRes] = await Promise.all([
      // Call postSignedWebhook to perform this step.
      postSignedWebhook(
        // Contribute this line to the enclosing declaration or statement.
        app,
        // Call buildStripeEvent to perform this step.
        buildStripeEvent({
          // Provide the event id field value.
          eventId: `evt_refund_ok_${op.id}_${Date.now()}`,
          // Provide the type field value.
          type: 'refund.updated',
          // Provide the object field value.
          object: { ...refundObject, status: 'succeeded' },
        })
      ),
      // Call postSignedWebhook to perform this step.
      postSignedWebhook(
        // Contribute this line to the enclosing declaration or statement.
        app,
        // Call buildStripeEvent to perform this step.
        buildStripeEvent({
          // Provide the event id field value.
          eventId: `evt_refund_fail_${op.id}_${Date.now()}`,
          // Provide the type field value.
          type: 'refund.failed',
          // Provide the object field value.
          object: { ...refundObject, status: 'failed' },
        })
      ),
    ]);
    // Assert that the value matches the intended expectation.
    expect(succeededRes.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(failedRes.status).toBe(200);

    // Create the final reservation constant.
    const finalReservation = await getReservationById(reservation.id);
    // Create the final op constant.
    const finalOp = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(finalReservation.status === 'refunded' && finalOp.status === 'failed').toBe(false);
    // Assert that the value matches the intended expectation.
    expect(finalOp.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(finalReservation.status).toBe('refunded');
  });

  // Define a single test case and its expectations.
  test('timeout after Stripe success leaves pending :full then retry applies', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Call stripeTestStub.throwNextCreateRefundAfterRecording to perform this step.
    stripeTestStub.throwNextCreateRefundAfterRecording();

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the first constant.
    const first = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'timeout_after_record',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: first.status, body: first.body }).toMatchObject({ status: 503 });
    // Assert that the value matches the intended expectation.
    expect(first.body.error.code).toBe('REFUND_INDETERMINATE');

    // Create the pending op constant.
    const pendingOp = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(pendingOp.status).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(pendingOp.idempotency_key).toBe(buildIdempotencyKey(reservation.id, 1));
    // Assert that the value matches the intended expectation.
    expect(pendingOp.idempotency_key).not.toBe(buildIdempotencyKey(reservation.id, 2));

    // Create the second constant.
    const second = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'retry_after_timeout',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: second.status, body: second.body }).toMatchObject({ status: 200 });

    // Create the latest constant.
    const latest = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(latest.idempotency_key).toBe(buildIdempotencyKey(reservation.id, 1));
    // Assert that the value matches the intended expectation.
    expect(latest.idempotency_key).not.toBe(buildIdempotencyKey(reservation.id, 2));
    // Assert that the value matches the intended expectation.
    expect(latest.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect((await getReservationById(reservation.id)).status).toBe('refunded');
  });

  // Define a single test case and its expectations.
  test('concurrent succeed apply and markFailed leave ledger succeeded', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the res constant.
    const res = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'race_succeed_vs_fail',
    });
    // Assert that the value matches the intended expectation.
    expect(res.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(res.body.data.status).toBe('succeeded');

    // Create the op constant.
    const op = await getRefundOperationByReservationId(reservation.id);
    // Destructure object properties into local variables.
    const { applySucceededRefund } = require('../../../src/services/payment/refund/applyRefundService');
    // Destructure object properties into local variables.
    const { markRefundFailed } = require('../../../src/services/payment/refund/refundLedgerService');

    // Wait until the asynchronous operation resolves.
    await Promise.all([
      // Call applySucceededRefund to perform this step.
      applySucceededRefund({
        // Provide the refund operation field value.
        refundOperation: {
          // Provide the id field value.
          id: op.id,
          // Provide the reservation id field value.
          reservationId: op.reservation_id,
          // Provide the status field value.
          status: op.status,
          // Provide the stripe refund id field value.
          stripeRefundId: op.stripe_refund_id,
        },
        // Provide the reservation id field value.
        reservationId: reservation.id,
        // Provide the stripe refund field value.
        stripeRefund: { id: op.stripe_refund_id, status: 'succeeded' },
        // Provide the actor field value.
        actor: { type: 'system' },
      }),
      // Call markRefundFailed to perform this step.
      markRefundFailed(
        // Contribute this line to the enclosing declaration or statement.
        { id: op.id, status: op.status },
        // Contribute this line to the enclosing declaration or statement.
        { code: 'failed', message: 'concurrent_fail' }
      ),
    ]);

    // Create the final op constant.
    const finalOp = await getRefundOperationByReservationId(reservation.id);
    // Create the final reservation constant.
    const finalReservation = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(finalReservation.status).toBe('refunded');
    // Assert that the value matches the intended expectation.
    expect(finalOp.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(finalOp.status).not.toBe('failed');
  });

  // Define a single test case and its expectations.
  test('full refund after quote reprice refunds the original paid amount', async () => {
    // Create the reservation constant.
    const reservation = await checkoutAndConfirm();
    // Create the paid cents constant.
    const paidCents = Math.round(Number(reservation.total_price) * 100);
    // Assert that the value matches the intended expectation.
    expect(paidCents).toBeGreaterThan(0);
    // Assert that the value matches the intended expectation.
    expect(Number(reservation.paid_amount_cents)).toBe(paidCents);

    // Destructure object properties into local variables.
    const { pool } = require('../../helpers/dbTestHarness');
    // Create the lowered constant.
    const lowered = Number(reservation.total_price) / 2;
    // Wait until the asynchronous operation resolves.
    await pool.query('UPDATE reservations SET total_price = $1 WHERE id = $2', [
      // Contribute this line to the enclosing declaration or statement.
      lowered,
      // Contribute this line to the enclosing declaration or statement.
      reservation.id,
    ]);
    // Wait until the asynchronous operation resolves.
    await pool.query('UPDATE orders SET total_price = $1 WHERE reservation_id = $2', [
      // Contribute this line to the enclosing declaration or statement.
      lowered,
      // Contribute this line to the enclosing declaration or statement.
      reservation.id,
    ]);

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the res constant.
    const res = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'reprice_then_full_refund',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    // Assert that the value matches the intended expectation.
    expect(res.body.data.status).toBe('succeeded');

    // Create the op constant.
    const op = await getRefundOperationByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(op.amount_cents).toBe(paidCents);
    // Assert that the value matches the intended expectation.
    expect(op.amount_cents).not.toBe(Math.round(lowered * 100));

    // Create the stripe refund constant.
    const stripeRefund = stripeTestStub.refunds.get(op.stripe_refund_id);
    // Assert that the value matches the intended expectation.
    expect(stripeRefund.amount).toBe(paidCents);

    // Create the refunded constant.
    const refunded = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(refunded.status).toBe('refunded');
    // Assert that the value matches the intended expectation.
    expect(Number(refunded.paid_amount_cents)).toBe(paidCents);

    // Create the order constant.
    const order = await getOrderByReservationId(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(order.is_deleted).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(order.status).toBe('cancelled');
  });
});
