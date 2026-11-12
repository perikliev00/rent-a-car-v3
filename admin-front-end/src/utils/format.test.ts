// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from './format'.
import { addDaysISO, formatPrice, imageUrl, todayISO, tomorrowISO } from './format';

// Declare a test suite grouping related cases.
describe('formatPrice', () => {
  // Define a single test case and its expectations.
  it('formats numbers as EUR currency', () => {
    // Assert that the value matches the intended expectation.
    expect(formatPrice(49.5)).toMatch(/49\.50/);
    // Assert that the value matches the intended expectation.
    expect(formatPrice(49.5)).toMatch(/€|EUR/);
  });

  // Define a single test case and its expectations.
  it('parses string amounts', () => {
    // Assert that the value matches the intended expectation.
    expect(formatPrice('100')).toMatch(/100\.00/);
  });
});

// Declare a test suite grouping related cases.
describe('imageUrl', () => {
  // Define a single test case and its expectations.
  it('returns placeholder for empty paths', () => {
    // Assert that the value matches the intended expectation.
    expect(imageUrl(null)).toBe('/placeholder-car.svg');
    // Assert that the value matches the intended expectation.
    expect(imageUrl(undefined)).toBe('/placeholder-car.svg');
  });

  // Define a single test case and its expectations.
  it('returns absolute URLs unchanged', () => {
    // Assert that the value matches the intended expectation.
    expect(imageUrl('https://cdn.example.com/car.jpg')).toBe('https://cdn.example.com/car.jpg');
  });

  // Define a single test case and its expectations.
  it('prefixes API base for /images/ paths', () => {
    // Assert that the value matches the intended expectation.
    expect(imageUrl('/images/car.jpg')).toMatch(/\/images\/car\.jpg$/);
  });
});

// Declare a test suite grouping related cases.
describe('date helpers', () => {
  // Define a single test case and its expectations.
  it('returns ISO date strings', () => {
    // Assert that the value matches the intended expectation.
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Assert that the value matches the intended expectation.
    expect(tomorrowISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Assert that the value matches the intended expectation.
    expect(addDaysISO('2026-07-01', 3)).toBe('2026-07-04');
  });
});
