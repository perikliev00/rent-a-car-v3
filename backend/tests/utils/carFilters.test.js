const {
  parseCarFilterRaw,
  filterCarsByComputedUnitPrice,
  filtersViewModel,
} = require('../../src/utils/carFilters');

describe('parseCarFilterRaw', () => {
  test('normalizes filter fields from query input', () => {
    const criteria = parseCarFilterRaw({
      categoryId: '2',
      transmission: 'Automatic',
      fuelType: 'Petrol',
      seatsMin: '4',
      seatsMax: '7',
      priceMin: '30',
      priceMax: '80',
    });

    expect(criteria).toEqual({
      categoryId: 2,
      transmission: 'automatic',
      fuelType: 'petrol',
      seatsMin: 4,
      seatsMax: 7,
      priceMin: 30,
      priceMax: 80,
    });
  });

  test('supports legacy category field', () => {
    expect(parseCarFilterRaw({ category: '3' }).categoryId).toBe(3);
  });
});

describe('filterCarsByComputedUnitPrice', () => {
  const cars = [
    { id: 1, unitPrice: 40 },
    { id: 2, unitPrice: 60 },
    { id: 3, price: 90 },
  ];

  test('returns all cars when no price bounds are set', () => {
    expect(filterCarsByComputedUnitPrice(cars, parseCarFilterRaw({}))).toHaveLength(3);
  });

  test('filters by min and max unit price', () => {
    const filtered = filterCarsByComputedUnitPrice(
      cars,
      parseCarFilterRaw({ priceMin: '50', priceMax: '100' })
    );

    expect(filtered.map((car) => car.id)).toEqual([2, 3]);
  });
});

describe('filtersViewModel', () => {
  test('builds string view model for API filters', () => {
    const criteria = parseCarFilterRaw({
      categoryId: '1',
      transmission: 'manual',
      fuelType: 'diesel',
      seatsMin: '4',
      seatsMax: '5',
      priceMin: '20',
      priceMax: '50',
    });

    expect(filtersViewModel(criteria)).toEqual({
      categoryId: '1',
      transmission: 'manual',
      fuelType: 'diesel',
      priceMin: '20',
      priceMax: '50',
      seatsMin: '4',
      seatsMax: '5',
    });
  });
});
