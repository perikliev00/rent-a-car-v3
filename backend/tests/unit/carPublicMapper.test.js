// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  mapSqlCar,
  // Contribute this line to the enclosing declaration or statement.
  mapPublicCar,
// Continue the surrounding logic with this statement.
} = require('../../src/services/sql/carSqlService');

// Declare a test suite grouping related cases.
describe('car mappers public strip', () => {
  // Create the row constant.
  const row = {
    // Provide the id field value.
    id: 3,
    // Provide the name field value.
    name: 'Yaris',
    // Provide the image field value.
    image: '/img.jpg',
    // Provide the transmission field value.
    transmission: 'Automatic',
    // Provide the price field value.
    price: 40,
    // Provide the price per day field value.
    price_per_day: 40,
    // Provide the price tier 1 3 field value.
    price_tier_1_3: 40,
    // Provide the price tier 7 31 field value.
    price_tier_7_31: null,
    // Provide the price tier 31 plus field value.
    price_tier_31_plus: null,
    // Provide the seats field value.
    seats: 5,
    // Provide the fuel type field value.
    fuel_type: 'Petrol',
    // Provide the availability field value.
    availability: true,
    // Provide the status field value.
    status: 'available',
    // Provide the registration number field value.
    registration_number: 'CA1234AB',
    // Provide the vin field value.
    vin: 'VIN123456789',
    // Provide the mileage field value.
    mileage: 12000,
    // Provide the fuel level field value.
    fuel_level: 'half',
    // Provide the current location field value.
    current_location: 'Sofia',
    // Provide the insurance expiry field value.
    insurance_expiry: '2027-01-01',
    // Provide the technical inspection expiry field value.
    technical_inspection_expiry: '2026-12-01',
    // Provide the category id field value.
    category_id: 1,
    // Provide the category name field value.
    category_name: 'Economy',
    // Provide the is deleted field value.
    is_deleted: false,
    // Provide the deleted at field value.
    deleted_at: null,
    // Provide the created at field value.
    created_at: new Date(),
    // Provide the updated at field value.
    updated_at: new Date(),
  };

  // Define a single test case and its expectations.
  test('mapSqlCar includes fleet fields', () => {
    // Create the car constant.
    const car = mapSqlCar(row);
    // Assert that the value matches the intended expectation.
    expect(car.vin).toBe('VIN123456789');
    // Assert that the value matches the intended expectation.
    expect(car.registrationNumber).toBe('CA1234AB');
    // Assert that the value matches the intended expectation.
    expect(car.status).toBe('available');
    // Assert that the value matches the intended expectation.
    expect(car.mileage).toBe(12000);
  });

  // Define a single test case and its expectations.
  test('mapPublicCar omits fleet ops fields', () => {
    // Create the car constant.
    const car = mapPublicCar(row);
    // Assert that the value matches the intended expectation.
    expect(car.vin).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(car.registrationNumber).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(car.mileage).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(car.fuelLevel).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(car.currentLocation).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(car.insuranceExpiry).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(car.technicalInspectionExpiry).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(car.status).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(car.name).toBe('Yaris');
    // Assert that the value matches the intended expectation.
    expect(car.availability).toBe(true);
  });
});
