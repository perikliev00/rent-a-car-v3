const localStorage = require('../src/services/storage/localStorageService');

describe('localStorageService', () => {
  describe('isManagedPublicUrl', () => {
    test('accepts managed upload URLs', () => {
      expect(localStorage.isManagedPublicUrl('/images/uploads/car-123.jpg')).toBe(true);
    });

    test('rejects static seed assets', () => {
      expect(localStorage.isManagedPublicUrl('/images/golf7.jpg')).toBe(false);
    });

    test('rejects paths outside uploads prefix', () => {
      expect(localStorage.isManagedPublicUrl('/images/icons.svg')).toBe(false);
    });
  });

  describe('generateStoredFilename', () => {
    test('uses car- prefix and preserves original extension', () => {
      const filename = localStorage.generateStoredFilename('photo.PNG');
      expect(filename).toMatch(/^car-\d+-[\d]+\.png$/);
    });
  });

  describe('buildPublicUrl', () => {
    test('maps filename to public path', () => {
      expect(localStorage.buildPublicUrl('car-1.jpg')).toBe('/images/uploads/car-1.jpg');
    });
  });
});
