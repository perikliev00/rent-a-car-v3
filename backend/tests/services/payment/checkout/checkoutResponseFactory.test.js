const {
  buildRenderOrderPageResponse,
  buildRedirectResponse,
} = require('../../../../src/services/payment/checkout/checkoutResponseFactory');

describe('checkoutResponseFactory', () => {
  test('buildRenderOrderPageResponse returns render payload', () => {
    const car = { id: 1 };
    const formData = { email: 'a@b.com' };

    expect(buildRenderOrderPageResponse(car, formData, 'Error', { foo: 'bar' })).toEqual({
      type: 'renderOrderPage',
      car,
      formData,
      message: 'Error',
      options: { foo: 'bar' },
    });
  });

  test('buildRedirectResponse defaults status code to 303', () => {
    expect(buildRedirectResponse('https://stripe.test/checkout')).toEqual({
      type: 'redirect',
      statusCode: 303,
      url: 'https://stripe.test/checkout',
    });
  });
});
