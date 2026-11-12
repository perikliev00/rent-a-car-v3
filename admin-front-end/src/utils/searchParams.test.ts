import { describe, expect, it } from 'vitest';
import {
  defaultSearchParams,
  normalizeClientExtras,
  parseSearchFromUrl,
  searchParamsToQuery,
} from './searchParams';

describe('searchParamsToQuery', () => {
  it('maps search params to URL query keys', () => {
    const search = defaultSearchParams();
    expect(searchParamsToQuery(search)).toEqual({
      'pickup-date': search.pickupDate,
      'return-date': search.returnDate,
      'pickup-time': search.pickupTime,
      'return-time': search.returnTime,
      'pickup-location': search.pickupLocation,
      'return-location': search.returnLocation,
    });
  });

  it('includes extras and hotelDelivery when set', () => {
    const search = {
      ...defaultSearchParams(),
      extras: ['child_seat', 'insurance_full'],
      hotelDelivery: true,
    };
    expect(searchParamsToQuery(search)).toMatchObject({
      extras: 'child_seat,insurance_full',
      hotelDelivery: '1',
    });
  });
});

describe('parseSearchFromUrl', () => {
  it('returns null when required params are missing', () => {
    expect(parseSearchFromUrl(new URLSearchParams('pickup-date=2026-07-01'))).toBeNull();
  });

  it('parses a complete search query', () => {
    const params = new URLSearchParams({
      'pickup-date': '2026-07-01',
      'return-date': '2026-07-05',
      'pickup-time': '10:00',
      'return-time': '18:00',
      'pickup-location': 'office',
      'return-location': 'burgas-airport',
      extras: 'child_seat,insurance_basic,insurance_full',
      hotelDelivery: '1',
    });

    expect(parseSearchFromUrl(params)).toEqual({
      pickupDate: '2026-07-01',
      returnDate: '2026-07-05',
      pickupTime: '10:00',
      returnTime: '18:00',
      pickupLocation: 'office',
      returnLocation: 'burgas-airport',
      extras: ['child_seat', 'insurance_full'],
      hotelDelivery: true,
    });
  });
});

describe('normalizeClientExtras', () => {
  it('drops insurance_basic when insurance_full is present', () => {
    expect(normalizeClientExtras(['insurance_basic', 'child_seat', 'insurance_full'])).toEqual([
      'child_seat',
      'insurance_full',
    ]);
  });
});

describe('defaultSearchParams', () => {
  it('uses office locations and consecutive dates', () => {
    const params = defaultSearchParams();
    expect(params.pickupLocation).toBe('office');
    expect(params.returnLocation).toBe('office');
    expect(params.pickupTime).toBe('10:00');
    expect(params.returnTime).toBe('10:00');
    expect(params.returnDate > params.pickupDate).toBe(true);
    expect(params.extras).toEqual([]);
    expect(params.hotelDelivery).toBe(false);
  });
});
