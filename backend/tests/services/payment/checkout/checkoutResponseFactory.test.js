// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildRenderOrderPageResponse,
  // Contribute this line to the enclosing declaration or statement.
  buildRedirectResponse,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/checkout/checkoutResponseFactory');

// Declare a test suite grouping related cases.
describe('checkoutResponseFactory', () => {
  // Define a single test case and its expectations.
  test('buildRenderOrderPageResponse returns render payload', () => {
    // Create the car constant.
    const car = { id: 1 };
    // Create the form data constant.
    const formData = { email: 'a@b.com' };

    // Assert that the value matches the intended expectation.
    expect(buildRenderOrderPageResponse(car, formData, 'Error', { foo: 'bar' })).toEqual({
      // Provide the type field value.
      type: 'renderOrderPage',
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      formData,
      // Provide the message field value.
      message: 'Error',
      // Provide the options field value.
      options: { foo: 'bar' },
    });
  });

  // Define a single test case and its expectations.
  test('buildRedirectResponse defaults status code to 303', () => {
    // Assert that the value matches the intended expectation.
    expect(buildRedirectResponse('https://stripe.test/checkout')).toEqual({
      // Provide the type field value.
      type: 'redirect',
      // Provide the status code field value.
      statusCode: 303,
      // Provide the url field value.
      url: 'https://stripe.test/checkout',
    });
  });
});
