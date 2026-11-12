// Call jest.mock to perform this step.
jest.mock('express-validator', () => ({
  // Provide the validation result field value.
  validationResult: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/utils/bookingValidation', () => ({
  // Provide the validate booking dates field value.
  validateBookingDates: jest.fn(),
}));

// Destructure object properties into local variables.
const { validationResult } = require('express-validator');
// Destructure object properties into local variables.
const { validateBookingDates } = require('../../../../src/utils/bookingValidation');
// Destructure object properties into local variables.
const { validateCheckoutRequest } = require('../../../../src/services/payment/checkout/checkoutValidationService');

// Declare a test suite grouping related cases.
describe('validateCheckoutRequest', () => {
  // Create the car constant.
  const car = { id: 1 };
  // Create the form data constant.
  const formData = {
    // Provide the pickup date field value.
    pickupDate: '2026-08-01',
    // Provide the return date field value.
    returnDate: '2026-08-05',
    // Provide the pickup time field value.
    pickupTime: '10:00',
    // Provide the return time field value.
    returnTime: '10:00',
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('returns validation render response for express-validator errors', () => {
    // Call validationResult.mockReturnValue to perform this step.
    validationResult.mockReturnValue({
      // Provide the is empty field value.
      isEmpty: () => false,
      // Provide the array field value.
      array: () => [{ msg: 'Email is required.' }],
    });

    // Create the result constant.
    const result = validateCheckoutRequest({}, car, formData);

    // Assert that the value matches the intended expectation.
    expect(result.ok).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.response.message).toBe('Email is required.');
  });

  // Define a single test case and its expectations.
  test('returns booking date error when dates are invalid', () => {
    // Call validationResult.mockReturnValue to perform this step.
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    // Call validateBookingDates.mockReturnValue to perform this step.
    validateBookingDates.mockReturnValue({
      // Provide the is valid field value.
      isValid: false,
      // Provide the errors field value.
      errors: ['Return date must be after pick-up date.'],
      // Provide the start date field value.
      startDate: null,
      // Provide the end date field value.
      endDate: null,
    });

    // Create the result constant.
    const result = validateCheckoutRequest({}, car, formData);

    // Assert that the value matches the intended expectation.
    expect(result.ok).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.response.message).toBe('Return date must be after pick-up date.');
  });

  // Define a single test case and its expectations.
  test('returns parsed dates when validation succeeds', () => {
    // Create the start date constant.
    const startDate = new Date('2026-08-01');
    // Create the end date constant.
    const endDate = new Date('2026-08-05');
    // Call validationResult.mockReturnValue to perform this step.
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    // Call validateBookingDates.mockReturnValue to perform this step.
    validateBookingDates.mockReturnValue({
      // Provide the is valid field value.
      isValid: true,
      // Provide the errors field value.
      errors: [],
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
    });

    // Assert that the value matches the intended expectation.
    expect(validateCheckoutRequest({}, car, formData)).toEqual({
      // Provide the ok field value.
      ok: true,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
    });
  });
});
