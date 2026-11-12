// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  defaultSearchParams,
  // Contribute this line to the enclosing declaration or statement.
  normalizeClientExtras,
  // Contribute this line to the enclosing declaration or statement.
  parseSearchFromUrl,
  // Contribute this line to the enclosing declaration or statement.
  searchParamsToQuery,
// Contribute this line to the enclosing declaration or statement.
} from './searchParams';

// Declare a test suite grouping related cases.
describe('searchParamsToQuery', () => {
  // Define a single test case and its expectations.
  it('maps search params to URL query keys', () => {
    // Create the search constant.
    const search = defaultSearchParams();
    // Assert that the value matches the intended expectation.
    expect(searchParamsToQuery(search)).toEqual({
      // Supply the literal value used by the enclosing expression.
      'pickup-date': search.pickupDate,
      // Supply the literal value used by the enclosing expression.
      'return-date': search.returnDate,
      // Supply the literal value used by the enclosing expression.
      'pickup-time': search.pickupTime,
      // Supply the literal value used by the enclosing expression.
      'return-time': search.returnTime,
      // Supply the literal value used by the enclosing expression.
      'pickup-location': search.pickupLocation,
      // Supply the literal value used by the enclosing expression.
      'return-location': search.returnLocation,
    });
  });

  // Define a single test case and its expectations.
  it('includes extras and hotelDelivery when set', () => {
    // Create the search constant.
    const search = {
      // Call ...defaultSearchParams to perform this step.
      ...defaultSearchParams(),
      // Provide the extras field value.
      extras: ['child_seat', 'insurance_full'],
      // Provide the hotel delivery field value.
      hotelDelivery: true,
    };
    // Assert that the value matches the intended expectation.
    expect(searchParamsToQuery(search)).toMatchObject({
      // Provide the extras field value.
      extras: 'child_seat,insurance_full',
      // Provide the hotel delivery field value.
      hotelDelivery: '1',
    });
  });
});

// Declare a test suite grouping related cases.
describe('parseSearchFromUrl', () => {
  // Define a single test case and its expectations.
  it('returns null when required params are missing', () => {
    // Assert that the value matches the intended expectation.
    expect(parseSearchFromUrl(new URLSearchParams('pickup-date=2026-07-01'))).toBeNull();
  });

  // Define a single test case and its expectations.
  it('parses a complete search query', () => {
    // Create the params constant.
    const params = new URLSearchParams({
      // Supply the literal value used by the enclosing expression.
      'pickup-date': '2026-07-01',
      // Supply the literal value used by the enclosing expression.
      'return-date': '2026-07-05',
      // Supply the literal value used by the enclosing expression.
      'pickup-time': '10:00',
      // Supply the literal value used by the enclosing expression.
      'return-time': '18:00',
      // Supply the literal value used by the enclosing expression.
      'pickup-location': 'office',
      // Supply the literal value used by the enclosing expression.
      'return-location': 'burgas-airport',
      // Provide the extras field value.
      extras: 'child_seat,insurance_basic,insurance_full',
      // Provide the hotel delivery field value.
      hotelDelivery: '1',
    });

    // Assert that the value matches the intended expectation.
    expect(parseSearchFromUrl(params)).toEqual({
      // Provide the pickup date field value.
      pickupDate: '2026-07-01',
      // Provide the return date field value.
      returnDate: '2026-07-05',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '18:00',
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'burgas-airport',
      // Provide the extras field value.
      extras: ['child_seat', 'insurance_full'],
      // Provide the hotel delivery field value.
      hotelDelivery: true,
    });
  });
});

// Declare a test suite grouping related cases.
describe('normalizeClientExtras', () => {
  // Define a single test case and its expectations.
  it('drops insurance_basic when insurance_full is present', () => {
    // Assert that the value matches the intended expectation.
    expect(normalizeClientExtras(['insurance_basic', 'child_seat', 'insurance_full'])).toEqual([
      // Supply the literal value used by the enclosing expression.
      'child_seat',
      // Supply the literal value used by the enclosing expression.
      'insurance_full',
    ]);
  });
});

// Declare a test suite grouping related cases.
describe('defaultSearchParams', () => {
  // Define a single test case and its expectations.
  it('uses office locations and consecutive dates', () => {
    // Create the params constant.
    const params = defaultSearchParams();
    // Assert that the value matches the intended expectation.
    expect(params.pickupLocation).toBe('office');
    // Assert that the value matches the intended expectation.
    expect(params.returnLocation).toBe('office');
    // Assert that the value matches the intended expectation.
    expect(params.pickupTime).toBe('10:00');
    // Assert that the value matches the intended expectation.
    expect(params.returnTime).toBe('10:00');
    // Assert that the value matches the intended expectation.
    expect(params.returnDate > params.pickupDate).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(params.extras).toEqual([]);
    // Assert that the value matches the intended expectation.
    expect(params.hotelDelivery).toBe(false);
  });
});
