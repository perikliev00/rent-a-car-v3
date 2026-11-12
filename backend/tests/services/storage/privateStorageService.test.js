// Create the original env constant.
const ORIGINAL_ENV = { ...process.env };

// Declare a test suite grouping related cases.
describe('privateStorageService factory', () => {
  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Update process.env with the right-hand side value.
    process.env = { ...ORIGINAL_ENV };
    // Call jest.resetModules to perform this step.
    jest.resetModules();
  });

  // Define a single test case and its expectations.
  test('defaults to the local driver', () => {
    // Delete the specified property from the object.
    delete process.env.PRIVATE_STORAGE_DRIVER;
    // Call jest.isolateModules to perform this step.
    jest.isolateModules(() => {
      // Require the '../../../src/services/storage/privateStorageService' module as storage.
      const storage = require('../../../src/services/storage/privateStorageService');
      // Assert that the value matches the intended expectation.
      expect(storage.driver).toBe('local');
    });
  });

  // Define a single test case and its expectations.
  test('selects the s3 driver', () => {
    // Update process.env.PRIVATE_STORAGE_DRIVER with the right-hand side value.
    process.env.PRIVATE_STORAGE_DRIVER = 's3';
    // Update process.env.PRIVATE_S3_BUCKET with the right-hand side value.
    process.env.PRIVATE_S3_BUCKET = 'luxride-private-docs';
    // Call jest.isolateModules to perform this step.
    jest.isolateModules(() => {
      // Require the '../../../src/services/storage/privateStorageService' module as storage.
      const storage = require('../../../src/services/storage/privateStorageService');
      // Assert that the value matches the intended expectation.
      expect(storage.driver).toBe('s3');
    });
  });

  // Define a single test case and its expectations.
  test('rejects unknown drivers', () => {
    // Update process.env.PRIVATE_STORAGE_DRIVER with the right-hand side value.
    process.env.PRIVATE_STORAGE_DRIVER = 'gcs';
    // Assert that the value matches the intended expectation.
    expect(() => {
      // Call jest.isolateModules to perform this step.
      jest.isolateModules(() => {
        // Call require to perform this step.
        require('../../../src/services/storage/privateStorageService');
      });
    // Continue the surrounding logic with this statement.
    }).toThrow('Unsupported PRIVATE_STORAGE_DRIVER: gcs');
  });
});
