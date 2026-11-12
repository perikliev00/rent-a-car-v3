const ORIGINAL_ENV = { ...process.env };

describe('privateStorageService factory', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  test('defaults to the local driver', () => {
    delete process.env.PRIVATE_STORAGE_DRIVER;
    jest.isolateModules(() => {
      const storage = require('../../../src/services/storage/privateStorageService');
      expect(storage.driver).toBe('local');
    });
  });

  test('selects the s3 driver', () => {
    process.env.PRIVATE_STORAGE_DRIVER = 's3';
    process.env.PRIVATE_S3_BUCKET = 'luxride-private-docs';
    jest.isolateModules(() => {
      const storage = require('../../../src/services/storage/privateStorageService');
      expect(storage.driver).toBe('s3');
    });
  });

  test('rejects unknown drivers', () => {
    process.env.PRIVATE_STORAGE_DRIVER = 'gcs';
    expect(() => {
      jest.isolateModules(() => {
        require('../../../src/services/storage/privateStorageService');
      });
    }).toThrow('Unsupported PRIVATE_STORAGE_DRIVER: gcs');
  });
});
