jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));
jest.mock('../../../../src/utils/bookingValidation', () => ({
  validateBookingDates: jest.fn(),
}));

const { validationResult } = require('express-validator');
const { validateBookingDates } = require('../../../../src/utils/bookingValidation');
const { validateCheckoutRequest } = require('../../../../src/services/payment/checkout/checkoutValidationService');

describe('validateCheckoutRequest', () => {
  const car = { id: 1 };
  const formData = {
    pickupDate: '2026-08-01',
    returnDate: '2026-08-05',
    pickupTime: '10:00',
    returnTime: '10:00',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns validation render response for express-validator errors', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Email is required.' }],
    });

    const result = validateCheckoutRequest({}, car, formData);

    expect(result.ok).toBe(false);
    expect(result.response.message).toBe('Email is required.');
  });

  test('returns booking date error when dates are invalid', () => {
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    validateBookingDates.mockReturnValue({
      isValid: false,
      errors: ['Return date must be after pick-up date.'],
      startDate: null,
      endDate: null,
    });

    const result = validateCheckoutRequest({}, car, formData);

    expect(result.ok).toBe(false);
    expect(result.response.message).toBe('Return date must be after pick-up date.');
  });

  test('returns parsed dates when validation succeeds', () => {
    const startDate = new Date('2026-08-01');
    const endDate = new Date('2026-08-05');
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    validateBookingDates.mockReturnValue({
      isValid: true,
      errors: [],
      startDate,
      endDate,
    });

    expect(validateCheckoutRequest({}, car, formData)).toEqual({
      ok: true,
      startDate,
      endDate,
    });
  });
});
