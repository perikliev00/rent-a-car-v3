// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  toISODate,
  // Contribute this line to the enclosing declaration or statement.
  toHHMM,
  // Contribute this line to the enclosing declaration or statement.
  buildOrderCreatePayload,
  // Contribute this line to the enclosing declaration or statement.
  extractStoredRange,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/admin/order/orderMapper');

// Declare a test suite grouping related cases.
describe('orderMapper', () => {
  // Define a single test case and its expectations.
  test('toISODate normalizes date values', () => {
    // Assert that the value matches the intended expectation.
    expect(toISODate('2026-07-10T12:00:00.000Z')).toBe('2026-07-10');
    // Assert that the value matches the intended expectation.
    expect(toISODate('')).toBe('');
  });

  // Define a single test case and its expectations.
  test('toHHMM normalizes time values', () => {
    // Assert that the value matches the intended expectation.
    expect(toHHMM('9:00')).toBe('09:00');
    // Assert that the value matches the intended expectation.
    expect(toHHMM('invalid')).toBe('');
  });

  // Define a single test case and its expectations.
  test('buildOrderCreatePayload maps command and pricing', () => {
    // Create the payload constant.
    const payload = buildOrderCreatePayload({
      // Provide the command field value.
      command: {
        // Provide the car id field value.
        carId: 7,
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '10:00',
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the hotel name field value.
        hotelName: 'Hotel',
        // Provide the contact field value.
        contact: {
          // Provide the full name field value.
          fullName: 'Jane',
          // Provide the phone number field value.
          phoneNumber: '+359888',
          // Provide the email field value.
          email: 'jane@example.com',
          // Provide the address field value.
          address: 'Main St',
        },
      },
      // Provide the range field value.
      range: { start: new Date('2026-07-10'), end: new Date('2026-07-12') },
      // Provide the pricing field value.
      pricing: {
        // Provide the rental days field value.
        rentalDays: 2,
        // Provide the delivery price field value.
        deliveryPrice: 0,
        // Provide the return price field value.
        returnPrice: 0,
        // Provide the total price field value.
        totalPrice: 120,
      },
    });

    // Assert that the value matches the intended expectation.
    expect(payload).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the car id field value.
        carId: 7,
        // Provide the total price field value.
        totalPrice: 120,
        // Provide the full name field value.
        fullName: 'Jane',
        // Provide the hotel name field value.
        hotelName: 'Hotel',
      })
    );
  });

  // Define a single test case and its expectations.
  test('extractStoredRange finds overlapping stored block', () => {
    // Create the prev start constant.
    const prevStart = new Date('2026-07-10');
    // Create the prev end constant.
    const prevEnd = new Date('2026-07-12');
    // Create the blocks constant.
    const blocks = [
      // Contribute this line to the enclosing declaration or statement.
      { startDate: '2026-07-09', endDate: '2026-07-11' },
      // Contribute this line to the enclosing declaration or statement.
      { startDate: '2026-08-01', endDate: '2026-08-03' },
    ];

    // Create the result constant.
    const result = extractStoredRange(blocks, prevStart, prevEnd);

    // Assert that the value matches the intended expectation.
    expect(result.storedStart).toEqual(new Date('2026-07-09'));
    // Assert that the value matches the intended expectation.
    expect(result.storedEnd).toEqual(new Date('2026-07-11'));
  });
});
