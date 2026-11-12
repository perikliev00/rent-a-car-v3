// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from './api'.
import { getCarFromOrder, getCarIdString, type Car, type Order } from './api';

// Continue the surrounding logic with this statement.
const car: Car = {
  // Provide the id field value.
  id: 'car-1',
  // Provide the name field value.
  name: 'BMW 320',
  // Provide the image field value.
  image: '/cars/bmw.jpg',
  // Provide the transmission field value.
  transmission: 'Automatic',
  // Provide the fuel type field value.
  fuelType: 'Petrol',
  // Provide the seats field value.
  seats: 5,
  // Provide the availability field value.
  availability: true,
  // Provide the category field value.
  category: 'Premium',
};

// Declare a test suite grouping related cases.
describe('getCarFromOrder', () => {
  // Define a single test case and its expectations.
  it('returns populated car object and null for string carId', () => {
    // Assert that the value matches the intended expectation.
    expect(getCarFromOrder({ carId: car } as Order)).toEqual(car);
    // Assert that the value matches the intended expectation.
    expect(getCarFromOrder({ carId: 'car-1' } as Order)).toBeNull();
  });
});

// Declare a test suite grouping related cases.
describe('getCarIdString', () => {
  // Define a single test case and its expectations.
  it('returns id from car object or string carId', () => {
    // Assert that the value matches the intended expectation.
    expect(getCarIdString(car)).toBe('car-1');
    // Assert that the value matches the intended expectation.
    expect(getCarIdString('car-2')).toBe('car-2');
  });
});
