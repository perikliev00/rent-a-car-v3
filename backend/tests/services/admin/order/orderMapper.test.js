const {
  toISODate,
  toHHMM,
  buildOrderCreatePayload,
  extractStoredRange,
} = require('../../../../src/services/admin/order/orderMapper');

describe('orderMapper', () => {
  test('toISODate normalizes date values', () => {
    expect(toISODate('2026-07-10T12:00:00.000Z')).toBe('2026-07-10');
    expect(toISODate('')).toBe('');
  });

  test('toHHMM normalizes time values', () => {
    expect(toHHMM('9:00')).toBe('09:00');
    expect(toHHMM('invalid')).toBe('');
  });

  test('buildOrderCreatePayload maps command and pricing', () => {
    const payload = buildOrderCreatePayload({
      command: {
        carId: 7,
        pickupTime: '10:00',
        returnTime: '10:00',
        pickupLocation: 'office',
        returnLocation: 'office',
        hotelName: 'Hotel',
        contact: {
          fullName: 'Jane',
          phoneNumber: '+359888',
          email: 'jane@example.com',
          address: 'Main St',
        },
      },
      range: { start: new Date('2026-07-10'), end: new Date('2026-07-12') },
      pricing: {
        rentalDays: 2,
        deliveryPrice: 0,
        returnPrice: 0,
        totalPrice: 120,
      },
    });

    expect(payload).toEqual(
      expect.objectContaining({
        carId: 7,
        totalPrice: 120,
        fullName: 'Jane',
        hotelName: 'Hotel',
      })
    );
  });

  test('extractStoredRange finds overlapping stored block', () => {
    const prevStart = new Date('2026-07-10');
    const prevEnd = new Date('2026-07-12');
    const blocks = [
      { startDate: '2026-07-09', endDate: '2026-07-11' },
      { startDate: '2026-08-01', endDate: '2026-08-03' },
    ];

    const result = extractStoredRange(blocks, prevStart, prevEnd);

    expect(result.storedStart).toEqual(new Date('2026-07-09'));
    expect(result.storedEnd).toEqual(new Date('2026-07-11'));
  });
});
