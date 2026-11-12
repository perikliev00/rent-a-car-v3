// Require the '../src/services/storage/localStorageService' module as localStorage.
const localStorage = require('../src/services/storage/localStorageService');

// Declare a test suite grouping related cases.
describe('localStorageService', () => {
  // Declare a test suite grouping related cases.
  describe('isManagedPublicUrl', () => {
    // Define a single test case and its expectations.
    test('accepts managed upload URLs', () => {
      // Assert that the value matches the intended expectation.
      expect(localStorage.isManagedPublicUrl('/images/uploads/car-123.jpg')).toBe(true);
    });

    // Define a single test case and its expectations.
    test('rejects static seed assets', () => {
      // Assert that the value matches the intended expectation.
      expect(localStorage.isManagedPublicUrl('/images/golf7.jpg')).toBe(false);
    });

    // Define a single test case and its expectations.
    test('rejects paths outside uploads prefix', () => {
      // Assert that the value matches the intended expectation.
      expect(localStorage.isManagedPublicUrl('/images/icons.svg')).toBe(false);
    });
  });

  // Declare a test suite grouping related cases.
  describe('generateStoredFilename', () => {
    // Define a single test case and its expectations.
    test('uses car- prefix and preserves original extension', () => {
      // Create the filename constant.
      const filename = localStorage.generateStoredFilename('photo.PNG');
      // Assert that the value matches the intended expectation.
      expect(filename).toMatch(/^car-\d+-[\d]+\.png$/);
    });
  });

  // Declare a test suite grouping related cases.
  describe('buildPublicUrl', () => {
    // Define a single test case and its expectations.
    test('maps filename to public path', () => {
      // Assert that the value matches the intended expectation.
      expect(localStorage.buildPublicUrl('car-1.jpg')).toBe('/images/uploads/car-1.jpg');
    });
  });
});
