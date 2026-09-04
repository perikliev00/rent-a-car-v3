import { describe, expect, it } from 'vitest';
import { addDaysISO, formatPrice, imageUrl, todayISO, tomorrowISO } from './format';

describe('formatPrice', () => {
  it('formats numbers as EUR currency', () => {
    expect(formatPrice(49.5)).toMatch(/49\.50/);
    expect(formatPrice(49.5)).toMatch(/€|EUR/);
  });

  it('parses string amounts', () => {
    expect(formatPrice('100')).toMatch(/100\.00/);
  });
});

describe('imageUrl', () => {
  it('returns placeholder for empty paths', () => {
    expect(imageUrl(null)).toBe('/placeholder-car.svg');
    expect(imageUrl(undefined)).toBe('/placeholder-car.svg');
  });

  it('returns absolute URLs unchanged', () => {
    expect(imageUrl('https://cdn.example.com/car.jpg')).toBe('https://cdn.example.com/car.jpg');
  });

  it('prefixes API base for /images/ paths', () => {
    expect(imageUrl('/images/car.jpg')).toMatch(/\/images\/car\.jpg$/);
  });
});

describe('date helpers', () => {
  it('returns ISO date strings', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tomorrowISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(addDaysISO('2026-07-01', 3)).toBe('2026-07-04');
  });
});
