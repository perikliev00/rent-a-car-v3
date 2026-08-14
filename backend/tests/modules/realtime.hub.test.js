const hub = require('../../src/modules/realtime/realtime.hub');
const { buildLiveEvent } = require('../../src/modules/realtime/realtime.events');

function mockRes() {
  const chunks = [];
  return {
    chunks,
    write(chunk) {
      chunks.push(String(chunk));
      return true;
    },
    end() {
      this.ended = true;
    },
    ended: false,
  };
}

describe('realtime.hub', () => {
  beforeEach(() => {
    hub._resetForTests();
  });

  afterEach(() => {
    hub._resetForTests();
  });

  test('publish delivers to subscribers', () => {
    const res = mockRes();
    hub.subscribe(res);

    const event = buildLiveEvent('payment_succeeded', { reservationId: '1' });
    hub.publish(event);

    const body = res.chunks.join('');
    expect(body).toContain(`id: ${event.id}`);
    expect(body).toContain('event: payment_succeeded');
    expect(body).toContain('"reservationId":"1"');
  });

  test('ring buffer replays events after Last-Event-ID', () => {
    const first = buildLiveEvent('new_booking', { reservationId: '1' });
    const second = buildLiveEvent('reservation_confirmed', { reservationId: '1' });
    hub.publish(first);
    hub.publish(second);

    const res = mockRes();
    hub.subscribe(res, { lastEventId: first.id });

    const body = res.chunks.join('');
    expect(body).not.toContain(`id: ${first.id}\n`);
    expect(body).toContain(`id: ${second.id}`);
    expect(body).toContain('event: reservation_confirmed');
  });

  test('unsubscribe stops delivery', () => {
    const res = mockRes();
    const id = hub.subscribe(res);
    hub.unsubscribe(id);

    hub.publish(buildLiveEvent('car_returned', { reservationId: '2' }));
    expect(res.chunks.join('')).not.toContain('car_returned');
  });

  test('closeAll ends open responses', () => {
    const res = mockRes();
    hub.subscribe(res);
    expect(hub.getSubscriberCount()).toBe(1);
    hub.closeAll();
    expect(hub.getSubscriberCount()).toBe(0);
    expect(res.ended).toBe(true);
  });
});
