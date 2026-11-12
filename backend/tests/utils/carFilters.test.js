// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  parseCarFilterRaw,
  // Contribute this line to the enclosing declaration or statement.
  filterCarsByComputedUnitPrice,
  // Contribute this line to the enclosing declaration or statement.
  filtersViewModel,
// Continue the surrounding logic with this statement.
} = require('../../src/utils/carFilters');

// Declare a test suite grouping related cases.
describe('parseCarFilterRaw', () => {
  // Define a single test case and its expectations.
  test('normalizes filter fields from query input', () => {
    // Create the criteria constant.
    const criteria = parseCarFilterRaw({
      // Provide the category id field value.
      categoryId: '2',
      // Provide the transmission field value.
      transmission: 'Automatic',
      // Provide the fuel type field value.
      fuelType: 'Petrol',
      // Provide the seats min field value.
      seatsMin: '4',
      // Provide the seats max field value.
      seatsMax: '7',
      // Provide the price min field value.
      priceMin: '30',
      // Provide the price max field value.
      priceMax: '80',
    });

    // Assert that the value matches the intended expectation.
    expect(criteria).toEqual({
      // Provide the category id field value.
      categoryId: 2,
      // Provide the transmission field value.
      transmission: 'automatic',
      // Provide the fuel type field value.
      fuelType: 'petrol',
      // Provide the seats min field value.
      seatsMin: 4,
      // Provide the seats max field value.
      seatsMax: 7,
      // Provide the price min field value.
      priceMin: 30,
      // Provide the price max field value.
      priceMax: 80,
    });
  });

  // Define a single test case and its expectations.
  test('supports legacy category field', () => {
    // Assert that the value matches the intended expectation.
    expect(parseCarFilterRaw({ category: '3' }).categoryId).toBe(3);
  });
});

// Declare a test suite grouping related cases.
describe('filterCarsByComputedUnitPrice', () => {
  // Create the cars constant.
  const cars = [
    // Contribute this line to the enclosing declaration or statement.
    { id: 1, unitPrice: 40 },
    // Contribute this line to the enclosing declaration or statement.
    { id: 2, unitPrice: 60 },
    // Contribute this line to the enclosing declaration or statement.
    { id: 3, price: 90 },
  ];

  // Define a single test case and its expectations.
  test('returns all cars when no price bounds are set', () => {
    // Assert that the value matches the intended expectation.
    expect(filterCarsByComputedUnitPrice(cars, parseCarFilterRaw({}))).toHaveLength(3);
  });

  // Define a single test case and its expectations.
  test('filters by min and max unit price', () => {
    // Create the filtered constant.
    const filtered = filterCarsByComputedUnitPrice(
      // Contribute this line to the enclosing declaration or statement.
      cars,
      // Call parseCarFilterRaw to perform this step.
      parseCarFilterRaw({ priceMin: '50', priceMax: '100' })
    );

    // Assert that the value matches the intended expectation.
    expect(filtered.map((car) => car.id)).toEqual([2, 3]);
  });
});

// Declare a test suite grouping related cases.
describe('filtersViewModel', () => {
  // Define a single test case and its expectations.
  test('builds string view model for API filters', () => {
    // Create the criteria constant.
    const criteria = parseCarFilterRaw({
      // Provide the category id field value.
      categoryId: '1',
      // Provide the transmission field value.
      transmission: 'manual',
      // Provide the fuel type field value.
      fuelType: 'diesel',
      // Provide the seats min field value.
      seatsMin: '4',
      // Provide the seats max field value.
      seatsMax: '5',
      // Provide the price min field value.
      priceMin: '20',
      // Provide the price max field value.
      priceMax: '50',
    });

    // Assert that the value matches the intended expectation.
    expect(filtersViewModel(criteria)).toEqual({
      // Provide the category id field value.
      categoryId: '1',
      // Provide the transmission field value.
      transmission: 'manual',
      // Provide the fuel type field value.
      fuelType: 'diesel',
      // Provide the price min field value.
      priceMin: '20',
      // Provide the price max field value.
      priceMax: '50',
      // Provide the seats min field value.
      seatsMin: '4',
      // Provide the seats max field value.
      seatsMax: '5',
    });
  });
});
