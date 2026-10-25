const { renderNotification } = require('../../src/modules/notifications/notifications.sender');

const marker = '</pre><b>injected</b><a href="http://evil.example">x</a>';

const types = [
  'reservation_confirmation',
  'admin_new_booking_alert',
  'payment_failed',
  'pickup_reminder',
  'return_reminder',
  'abandoned_checkout_reminder',
  'expiring_insurance_alert',
  'maintenance_reminder',
  'paid_but_not_confirmed_alert',
  'unknown_type',
];

describe('notification HTML encoding', () => {
  test.each(types)('%s keeps untrusted text out of the HTML structure', (type) => {
    const rendered = renderNotification({
      type,
      payload: {
        orderId: marker,
        reservationId: marker,
        fullName: marker,
        carName: marker,
        pickupLocation: marker,
        returnLocation: marker,
        reason: marker,
        itemTitle: marker,
        itemType: marker,
        expiresAt: marker,
        startDate: marker,
        endDate: marker,
        email: marker,
      },
    });

    expect(rendered.html).not.toContain('<b>injected</b>');
    expect(rendered.html).not.toContain('<a href=');
    expect(rendered.html).toContain('&lt;/pre&gt;');
    expect(rendered.html).toContain('&lt;b&gt;');
    expect(rendered.text).toContain('<b>injected</b>');
    expect(rendered.subject).not.toContain('\n');
    expect(rendered.subject).not.toContain('\r');
  });
});
