const {
  TRANSMISSIONS,
  FUEL_TYPES,
  FUEL_LEVELS,
  CAR_SEATS_MIN,
  CAR_SEATS_MAX,
} = require('../../src/constants/carEnums');
const { computeDayPrice, computeBookingPrice } = require('../../src/utils/pricing');
const {
  REALISTIC_FLEET,
  REALISTIC_FLEET_CATEGORIES,
  fictionalVin,
  fictionalPlate,
} = require('../../sql/seed/realisticFleetData');

const VIN_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/;
const PLATE = /^C 10\d{2} XX$/;

function pricingCar(row) {
  return {
    price: row.price,
    priceTier_1_3: row.priceTier_1_3,
    priceTier_7_31: row.priceTier_7_31,
    priceTier_31_plus: row.priceTier_31_plus,
  };
}

describe('realistic fleet catalog', () => {
  test('contains exactly 20 cars with unique names, plates, and VINs', () => {
    expect(REALISTIC_FLEET).toHaveLength(20);
    const names = REALISTIC_FLEET.map((c) => c.name);
    const plates = REALISTIC_FLEET.map((c) => c.registrationNumber);
    const vins = REALISTIC_FLEET.map((c) => c.vin);
    expect(new Set(names).size).toBe(20);
    expect(new Set(plates).size).toBe(20);
    expect(new Set(vins).size).toBe(20);
  });

  test('uses fictional Bulgarian-style plates C 1001 XX … C 1020 XX', () => {
    REALISTIC_FLEET.forEach((car, index) => {
      expect(car.registrationNumber).toBe(fictionalPlate(index + 1));
      expect(car.registrationNumber).toMatch(PLATE);
      expect(car.registrationNumber.length).toBeLessThanOrEqual(32);
    });
  });

  test('uses fictional 17-character VIN-like values without I/O/Q', () => {
    REALISTIC_FLEET.forEach((car, index) => {
      expect(car.vin).toBe(fictionalVin(index + 1));
      expect(car.vin).toMatch(VIN_CHARS);
      expect(car.vin.startsWith('ZZ1RACV3SEED00')).toBe(true);
    });
  });

  test('uses app enums, seat limits, available status, and required image', () => {
    const expectedNames = [
      'Dacia Sandero',
      'Renault Clio',
      'Toyota Aygo',
      'Hyundai i10',
      'Kia Picanto',
      'Volkswagen Polo',
      'Opel Corsa',
      'Peugeot 208',
      'Renault Captur',
      'Dacia Duster',
      'Nissan Juke',
      'Volkswagen T-Cross',
      'Skoda Kamiq',
      'Toyota Corolla',
      'Volkswagen Golf',
      'Skoda Octavia',
      'Toyota Corolla Touring Sports',
      'Renault Megane Grandtour',
      'Volkswagen Touran',
      'Mercedes-Benz Vito',
    ];
    expect(REALISTIC_FLEET.map((c) => c.name)).toEqual(expectedNames);

    for (const car of REALISTIC_FLEET) {
      expect(TRANSMISSIONS).toContain(car.transmission);
      expect(FUEL_TYPES).toContain(car.fuelType);
      expect(FUEL_LEVELS).toContain(car.fuelLevel);
      expect(REALISTIC_FLEET_CATEGORIES).toContain(car.categoryName);
      expect(car.seats).toBeGreaterThanOrEqual(CAR_SEATS_MIN);
      expect(car.seats).toBeLessThanOrEqual(CAR_SEATS_MAX);
      expect(car.year).toBeGreaterThanOrEqual(2021);
      expect(car.year).toBeLessThanOrEqual(2025);
      expect(car.image).toBe('/placeholder-car.svg');
      expect(car.mileage).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(car.equipment)).toBe(true);
      expect(car.equipment.length).toBeGreaterThan(0);
    }

    expect(REALISTIC_FLEET.find((c) => c.name === 'Volkswagen Touran').seats).toBe(7);
    expect(REALISTIC_FLEET.find((c) => c.name === 'Mercedes-Benz Vito').seats).toBe(8);
    expect(REALISTIC_FLEET.some((c) => c.transmission === 'Manual')).toBe(true);
    expect(REALISTIC_FLEET.some((c) => c.transmission === 'Automatic')).toBe(true);
    expect(REALISTIC_FLEET.some((c) => c.fuelType === 'Petrol')).toBe(true);
    expect(REALISTIC_FLEET.some((c) => c.fuelType === 'Diesel')).toBe(true);
    expect(REALISTIC_FLEET.some((c) => c.fuelType === 'Hybrid')).toBe(true);
  });

  test('price tiers are positive and non-increasing with rental length', () => {
    for (const car of REALISTIC_FLEET) {
      expect(car.priceTier_1_3).toBeGreaterThan(0);
      expect(car.priceTier_7_31).toBeGreaterThan(0);
      expect(car.priceTier_31_plus).toBeGreaterThan(0);
      expect(car.priceTier_7_31).toBeLessThanOrEqual(car.priceTier_1_3);
      expect(car.priceTier_31_plus).toBeLessThanOrEqual(car.priceTier_7_31);
      expect(car.price).toBe(car.priceTier_1_3);
      expect(car.pricePerDay).toBe(car.priceTier_7_31);
    }
  });

  test('pricing engine returns a positive day and booking price for every car', () => {
    const start = new Date('2026-07-01T10:00:00Z');
    const end = new Date('2026-07-03T10:00:00Z');

    for (const car of REALISTIC_FLEET) {
      const mapped = pricingCar(car);
      expect(computeDayPrice(mapped, 1)).toBe(car.priceTier_1_3);
      expect(computeDayPrice(mapped, 7)).toBe(car.priceTier_7_31);
      expect(computeDayPrice(mapped, 32)).toBe(car.priceTier_31_plus);

      const quote = computeBookingPrice(mapped, start, end, 'office', 'office');
      expect(quote.rentalDays).toBe(2);
      expect(quote.dayPrice).toBe(car.priceTier_1_3);
      expect(quote.totalPrice).toBeGreaterThan(0);
      expect(quote.deposit).toBe(300);
    }
  });
});
