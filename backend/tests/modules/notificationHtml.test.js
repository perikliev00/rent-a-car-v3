// Destructure object properties into local variables.
const { renderNotification } = require('../../src/modules/notifications/notifications.sender');

// Create the marker constant.
const marker = '</pre><b>injected</b><a href="http://evil.example">x</a>';

// Create the types constant.
const types = [
  // Supply the literal value used by the enclosing expression.
  'reservation_confirmation',
  // Supply the literal value used by the enclosing expression.
  'admin_new_booking_alert',
  // Supply the literal value used by the enclosing expression.
  'payment_failed',
  // Supply the literal value used by the enclosing expression.
  'pickup_reminder',
  // Supply the literal value used by the enclosing expression.
  'return_reminder',
  // Supply the literal value used by the enclosing expression.
  'abandoned_checkout_reminder',
  // Supply the literal value used by the enclosing expression.
  'expiring_insurance_alert',
  // Supply the literal value used by the enclosing expression.
  'maintenance_reminder',
  // Supply the literal value used by the enclosing expression.
  'paid_but_not_confirmed_alert',
  // Supply the literal value used by the enclosing expression.
  'unknown_type',
];

// Declare a test suite grouping related cases.
describe('notification HTML encoding', () => {
  // Call test.each to perform this step.
  test.each(types)('%s keeps untrusted text out of the HTML structure', (type) => {
    // Create the rendered constant.
    const rendered = renderNotification({
      // Contribute this line to the enclosing declaration or statement.
      type,
      // Provide the payload field value.
      payload: {
        // Provide the order id field value.
        orderId: marker,
        // Provide the reservation id field value.
        reservationId: marker,
        // Provide the full name field value.
        fullName: marker,
        // Provide the car name field value.
        carName: marker,
        // Provide the pickup location field value.
        pickupLocation: marker,
        // Provide the return location field value.
        returnLocation: marker,
        // Provide the reason field value.
        reason: marker,
        // Provide the item title field value.
        itemTitle: marker,
        // Provide the item type field value.
        itemType: marker,
        // Provide the expires at field value.
        expiresAt: marker,
        // Provide the start date field value.
        startDate: marker,
        // Provide the end date field value.
        endDate: marker,
        // Provide the email field value.
        email: marker,
      },
    });

    // Assert that the value matches the intended expectation.
    expect(rendered.html).not.toContain('<b>injected</b>');
    // Assert that the value matches the intended expectation.
    expect(rendered.html).not.toContain('<a href=');
    // Assert that the value matches the intended expectation.
    expect(rendered.html).toContain('&lt;/pre&gt;');
    // Assert that the value matches the intended expectation.
    expect(rendered.html).toContain('&lt;b&gt;');
    // Assert that the value matches the intended expectation.
    expect(rendered.text).toContain('<b>injected</b>');
    // Assert that the value matches the intended expectation.
    expect(rendered.subject).not.toContain('\n');
    // Assert that the value matches the intended expectation.
    expect(rendered.subject).not.toContain('\r');
  });
});
