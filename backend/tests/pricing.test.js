const { computeBookingPrice, computePrice } = require('../src/utils/pricing');
const { buildDefaultConfig } = require('../src/services/sql/pricingConfigSqlService');

describe('computeBookingPrice (legacy compatible)', () => {
  const car = {
    price: 50,
    priceTier_1_3: 60,
    priceTier_7_31: 45,
    priceTier_31_plus: 35,
  };

  test('calculates total for short rental with location fees', () => {
    const start = new Date('2026-07-01T10:00:00Z');
    const end = new Date('2026-07-03T10:00:00Z');

    const result = computeBookingPrice(car, start, end, 'office', 'sunny-beach');

    expect(result.rentalDays).toBe(2);
    expect(result.dayPrice).toBe(60);
    expect(result.deliveryPrice).toBe(0);
    expect(result.returnPrice).toBe(25);
    expect(result.totalPrice).toBe(145);
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    expect(result.deposit).toBe(300);
  });

  test('uses medium tier for rentals up to 31 days', () => {
    const start = new Date('2026-07-01T00:00:00Z');
    const end = new Date('2026-07-10T00:00:00Z');

    const result = computeBookingPrice(car, start, end, 'office', 'office');

    expect(result.rentalDays).toBe(9);
    expect(result.dayPrice).toBe(45);
    expect(result.totalPrice).toBe(405);
  });

  test('returns zero totals for invalid dates', () => {
    const result = computeBookingPrice(car, null, null, 'office', 'office');

    expect(result.rentalDays).toBe(0);
    expect(result.totalPrice).toBe(0);
  });
});

describe('computePrice engine', () => {
  const car = { price: 100, priceTier_1_3: 100 };

  test('applies seasonal percent and insurance addon', () => {
    const config = buildDefaultConfig();
    config.seasons = [
      {
        id: 1,
        name: 'High season',
        startMonth: 7,
        startDay: 1,
        endMonth: 7,
        endDay: 31,
        adjType: 'percent',
        adjValue: 20,
        active: true,
      },
    ];
    config.extras = [
      {
        id: 1,
        code: 'insurance_full',
        label: 'Full insurance',
        mode: 'flat',
        amount: 60,
        active: true,
        sortOrder: 1,
      },
    ];
    config.deliveryFeeMap['burgas-airport'] = 20;
    config.discountRules = [
      {
        id: 1,
        kind: 'early_booking',
        name: 'Early booking',
        threshold: 0,
        adjType: 'percent',
        adjValue: 10,
        active: true,
      },
    ];

    const start = new Date('2026-07-10T10:00:00Z');
    const end = new Date('2026-07-12T10:00:00Z');
    const bookedAt = new Date('2026-06-01T10:00:00Z');

    const result = computePrice(
      car,
      start,
      end,
      'office',
      'burgas-airport',
      { extras: ['insurance_full'], bookedAt },
      config
    );

    // base 200 + season 40 + airport 20 + insurance 60 - early 10% of (200+40)=24 => 296
    expect(result.rentalDays).toBe(2);
    expect(result.lines.find((l) => l.code === 'base_rental').amount).toBe(200);
    expect(result.lines.find((l) => l.code.startsWith('season_')).amount).toBe(40);
    expect(result.lines.find((l) => l.code === 'extra_insurance_full').amount).toBe(60);
    expect(result.lines.find((l) => l.code === 'delivery_return').amount).toBe(20);
    expect(result.lines.find((l) => l.code === 'discount_early_booking').amount).toBe(-24);
    expect(result.totalPrice).toBe(296);
    expect(result.deposit).toBe(300);
    expect(result.snapshot.totalPrice).toBe(296);
  });

  test('deposit is not included in totalPrice', () => {
    const start = new Date('2026-07-01T00:00:00Z');
    const end = new Date('2026-07-02T00:00:00Z');
    const result = computePrice(car, start, end, 'office', 'office', {}, buildDefaultConfig());
    expect(result.totalPrice).toBe(100);
    expect(result.deposit).toBe(300);
    expect(result.lines.every((l) => l.type !== 'deposit')).toBe(true);
  });

  test('drops insurance_basic when insurance_full is also selected', () => {
    const config = buildDefaultConfig();
    config.extras = [
      {
        id: 1,
        code: 'insurance_basic',
        label: 'Basic insurance',
        mode: 'flat',
        amount: 30,
        active: true,
        sortOrder: 1,
      },
      {
        id: 2,
        code: 'insurance_full',
        label: 'Full insurance',
        mode: 'flat',
        amount: 60,
        active: true,
        sortOrder: 2,
      },
    ];
    const start = new Date('2026-07-01T00:00:00Z');
    const end = new Date('2026-07-02T00:00:00Z');
    const result = computePrice(
      car,
      start,
      end,
      'office',
      'office',
      { extras: ['insurance_basic', 'insurance_full'] },
      config
    );
    expect(result.lines.some((l) => l.code === 'extra_insurance_basic')).toBe(false);
    expect(result.lines.some((l) => l.code === 'extra_insurance_full')).toBe(true);
    expect(result.snapshot.selectedExtras).toEqual(['insurance_full']);
    expect(result.totalPrice).toBe(160);
  });
});
