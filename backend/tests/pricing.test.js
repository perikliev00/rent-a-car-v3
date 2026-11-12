// Destructure object properties into local variables.
const { computeBookingPrice, computePrice } = require('../src/utils/pricing');
// Destructure object properties into local variables.
const { buildDefaultConfig } = require('../src/services/sql/pricingConfigSqlService');

// Declare a test suite grouping related cases.
describe('computeBookingPrice (legacy compatible)', () => {
  // Create the car constant.
  const car = {
    // Provide the price field value.
    price: 50,
    // Provide the price tier 1 3 field value.
    priceTier_1_3: 60,
    // Provide the price tier 7 31 field value.
    priceTier_7_31: 45,
    // Provide the price tier 31 plus field value.
    priceTier_31_plus: 35,
  };

  // Define a single test case and its expectations.
  test('calculates total for short rental with location fees', () => {
    // Create the start constant.
    const start = new Date('2026-07-01T10:00:00Z');
    // Create the end constant.
    const end = new Date('2026-07-03T10:00:00Z');

    // Create the result constant.
    const result = computeBookingPrice(car, start, end, 'office', 'sunny-beach');

    // Assert that the value matches the intended expectation.
    expect(result.rentalDays).toBe(2);
    // Assert that the value matches the intended expectation.
    expect(result.dayPrice).toBe(60);
    // Assert that the value matches the intended expectation.
    expect(result.deliveryPrice).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(result.returnPrice).toBe(25);
    // Assert that the value matches the intended expectation.
    expect(result.totalPrice).toBe(145);
    // Assert that the value matches the intended expectation.
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    // Assert that the value matches the intended expectation.
    expect(result.deposit).toBe(300);
  });

  // Define a single test case and its expectations.
  test('uses medium tier for rentals up to 31 days', () => {
    // Create the start constant.
    const start = new Date('2026-07-01T00:00:00Z');
    // Create the end constant.
    const end = new Date('2026-07-10T00:00:00Z');

    // Create the result constant.
    const result = computeBookingPrice(car, start, end, 'office', 'office');

    // Assert that the value matches the intended expectation.
    expect(result.rentalDays).toBe(9);
    // Assert that the value matches the intended expectation.
    expect(result.dayPrice).toBe(45);
    // Assert that the value matches the intended expectation.
    expect(result.totalPrice).toBe(405);
  });

  // Define a single test case and its expectations.
  test('returns zero totals for invalid dates', () => {
    // Create the result constant.
    const result = computeBookingPrice(car, null, null, 'office', 'office');

    // Assert that the value matches the intended expectation.
    expect(result.rentalDays).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(result.totalPrice).toBe(0);
  });
});

// Declare a test suite grouping related cases.
describe('computePrice engine', () => {
  // Create the car constant.
  const car = { price: 100, priceTier_1_3: 100 };

  // Define a single test case and its expectations.
  test('applies seasonal percent and insurance addon', () => {
    // Create the config constant.
    const config = buildDefaultConfig();
    // Update config.seasons with the right-hand side value.
    config.seasons = [
      {
        // Provide the id field value.
        id: 1,
        // Provide the name field value.
        name: 'High season',
        // Provide the start month field value.
        startMonth: 7,
        // Provide the start day field value.
        startDay: 1,
        // Provide the end month field value.
        endMonth: 7,
        // Provide the end day field value.
        endDay: 31,
        // Provide the adj type field value.
        adjType: 'percent',
        // Provide the adj value field value.
        adjValue: 20,
        // Provide the active field value.
        active: true,
      },
    ];
    // Update config.extras with the right-hand side value.
    config.extras = [
      {
        // Provide the id field value.
        id: 1,
        // Provide the code field value.
        code: 'insurance_full',
        // Provide the label field value.
        label: 'Full insurance',
        // Provide the mode field value.
        mode: 'flat',
        // Provide the amount field value.
        amount: 60,
        // Provide the active field value.
        active: true,
        // Provide the sort order field value.
        sortOrder: 1,
      },
    ];
    // Continue the surrounding logic with this statement.
    config.deliveryFeeMap['burgas-airport'] = 20;
    // Update config.discountRules with the right-hand side value.
    config.discountRules = [
      {
        // Provide the id field value.
        id: 1,
        // Provide the kind field value.
        kind: 'early_booking',
        // Provide the name field value.
        name: 'Early booking',
        // Provide the threshold field value.
        threshold: 0,
        // Provide the adj type field value.
        adjType: 'percent',
        // Provide the adj value field value.
        adjValue: 10,
        // Provide the active field value.
        active: true,
      },
    ];

    // Create the start constant.
    const start = new Date('2026-07-10T10:00:00Z');
    // Create the end constant.
    const end = new Date('2026-07-12T10:00:00Z');
    // Create the booked at constant.
    const bookedAt = new Date('2026-06-01T10:00:00Z');

    // Create the result constant.
    const result = computePrice(
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      start,
      // Contribute this line to the enclosing declaration or statement.
      end,
      // Supply the literal value used by the enclosing expression.
      'office',
      // Supply the literal value used by the enclosing expression.
      'burgas-airport',
      // Contribute this line to the enclosing declaration or statement.
      { extras: ['insurance_full'], bookedAt },
      // Reference the identifier used by the enclosing expression.
      config
    );

    // base 200 + season 40 + airport 20 + insurance 60 - early 10% of (200+40)=24 => 296
    expect(result.rentalDays).toBe(2);
    // Assert that the value matches the intended expectation.
    expect(result.lines.find((l) => l.code === 'base_rental').amount).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(result.lines.find((l) => l.code.startsWith('season_')).amount).toBe(40);
    // Assert that the value matches the intended expectation.
    expect(result.lines.find((l) => l.code === 'extra_insurance_full').amount).toBe(60);
    // Assert that the value matches the intended expectation.
    expect(result.lines.find((l) => l.code === 'delivery_return').amount).toBe(20);
    // Assert that the value matches the intended expectation.
    expect(result.lines.find((l) => l.code === 'discount_early_booking').amount).toBe(-24);
    // Assert that the value matches the intended expectation.
    expect(result.totalPrice).toBe(296);
    // Assert that the value matches the intended expectation.
    expect(result.deposit).toBe(300);
    // Assert that the value matches the intended expectation.
    expect(result.snapshot.totalPrice).toBe(296);
  });

  // Define a single test case and its expectations.
  test('deposit is not included in totalPrice', () => {
    // Create the start constant.
    const start = new Date('2026-07-01T00:00:00Z');
    // Create the end constant.
    const end = new Date('2026-07-02T00:00:00Z');
    // Create the result constant.
    const result = computePrice(car, start, end, 'office', 'office', {}, buildDefaultConfig());
    // Assert that the value matches the intended expectation.
    expect(result.totalPrice).toBe(100);
    // Assert that the value matches the intended expectation.
    expect(result.deposit).toBe(300);
    // Assert that the value matches the intended expectation.
    expect(result.lines.every((l) => l.type !== 'deposit')).toBe(true);
  });

  // Define a single test case and its expectations.
  test('drops insurance_basic when insurance_full is also selected', () => {
    // Create the config constant.
    const config = buildDefaultConfig();
    // Update config.extras with the right-hand side value.
    config.extras = [
      {
        // Provide the id field value.
        id: 1,
        // Provide the code field value.
        code: 'insurance_basic',
        // Provide the label field value.
        label: 'Basic insurance',
        // Provide the mode field value.
        mode: 'flat',
        // Provide the amount field value.
        amount: 30,
        // Provide the active field value.
        active: true,
        // Provide the sort order field value.
        sortOrder: 1,
      },
      {
        // Provide the id field value.
        id: 2,
        // Provide the code field value.
        code: 'insurance_full',
        // Provide the label field value.
        label: 'Full insurance',
        // Provide the mode field value.
        mode: 'flat',
        // Provide the amount field value.
        amount: 60,
        // Provide the active field value.
        active: true,
        // Provide the sort order field value.
        sortOrder: 2,
      },
    ];
    // Create the start constant.
    const start = new Date('2026-07-01T00:00:00Z');
    // Create the end constant.
    const end = new Date('2026-07-02T00:00:00Z');
    // Create the result constant.
    const result = computePrice(
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      start,
      // Contribute this line to the enclosing declaration or statement.
      end,
      // Supply the literal value used by the enclosing expression.
      'office',
      // Supply the literal value used by the enclosing expression.
      'office',
      // Contribute this line to the enclosing declaration or statement.
      { extras: ['insurance_basic', 'insurance_full'] },
      // Reference the identifier used by the enclosing expression.
      config
    );
    // Assert that the value matches the intended expectation.
    expect(result.lines.some((l) => l.code === 'extra_insurance_basic')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.lines.some((l) => l.code === 'extra_insurance_full')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.snapshot.selectedExtras).toEqual(['insurance_full']);
    // Assert that the value matches the intended expectation.
    expect(result.totalPrice).toBe(160);
  });
});
