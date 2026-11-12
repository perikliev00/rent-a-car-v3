import { describe, expect, it } from 'vitest';
import { getCarFromOrder, getCarIdString, type Car, type Order } from './api';

const car: Car = {
  id: 'car-1',
  name: 'BMW 320',
  image: '/cars/bmw.jpg',
  transmission: 'Automatic',
  fuelType: 'Petrol',
  seats: 5,
  availability: true,
  category: 'Premium',
};

describe('getCarFromOrder', () => {
  it('returns populated car object and null for string carId', () => {
    expect(getCarFromOrder({ carId: car } as Order)).toEqual(car);
    expect(getCarFromOrder({ carId: 'car-1' } as Order)).toBeNull();
  });
});

describe('getCarIdString', () => {
  it('returns id from car object or string carId', () => {
    expect(getCarIdString(car)).toBe('car-1');
    expect(getCarIdString('car-2')).toBe('car-2');
  });
});
