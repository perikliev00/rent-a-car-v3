const {
  mapSqlCar,
  mapPublicCar,
} = require('../../src/services/sql/carSqlService');

describe('car mappers public strip', () => {
  const row = {
    id: 3,
    name: 'Yaris',
    image: '/img.jpg',
    transmission: 'Automatic',
    price: 40,
    price_per_day: 40,
    price_tier_1_3: 40,
    price_tier_7_31: null,
    price_tier_31_plus: null,
    seats: 5,
    fuel_type: 'Petrol',
    availability: true,
    status: 'available',
    registration_number: 'CA1234AB',
    vin: 'VIN123456789',
    mileage: 12000,
    fuel_level: 'half',
    current_location: 'Sofia',
    insurance_expiry: '2027-01-01',
    technical_inspection_expiry: '2026-12-01',
    category_id: 1,
    category_name: 'Economy',
    is_deleted: false,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  test('mapSqlCar includes fleet fields', () => {
    const car = mapSqlCar(row);
    expect(car.vin).toBe('VIN123456789');
    expect(car.registrationNumber).toBe('CA1234AB');
    expect(car.status).toBe('available');
    expect(car.mileage).toBe(12000);
  });

  test('mapPublicCar omits fleet ops fields', () => {
    const car = mapPublicCar(row);
    expect(car.vin).toBeUndefined();
    expect(car.registrationNumber).toBeUndefined();
    expect(car.mileage).toBeUndefined();
    expect(car.fuelLevel).toBeUndefined();
    expect(car.currentLocation).toBeUndefined();
    expect(car.insuranceExpiry).toBeUndefined();
    expect(car.technicalInspectionExpiry).toBeUndefined();
    expect(car.status).toBeUndefined();
    expect(car.name).toBe('Yaris');
    expect(car.availability).toBe(true);
  });
});
