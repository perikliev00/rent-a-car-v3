const {
  isValidLocation,
  formatLocationName,
  getLocationOptions,
  feeFor,
} = require('../../src/services/locationService');

describe('locationService', () => {
  test('isValidLocation accepts known locations', () => {
    expect(isValidLocation('office')).toBe(true);
    expect(isValidLocation('unknown')).toBe(false);
  });

  test('formatLocationName returns label for known location', () => {
    expect(formatLocationName('office')).toBeTruthy();
  });

  test('getLocationOptions returns id/label pairs', () => {
    const options = getLocationOptions();
    expect(options[0]).toEqual(expect.objectContaining({ id: expect.any(String), label: expect.any(String) }));
  });

  test('feeFor returns configured delivery fee', () => {
    expect(typeof feeFor('office')).toBe('number');
  });
});
