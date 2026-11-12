// Destructure object properties into local variables.
const { generatePrivateKey, isValidPrivateStorageKey, KEY_PREFIX } = require('../../../src/services/storage/privateStorageKeys');

// Declare a test suite grouping related cases.
describe('privateStorageKeys', () => {
  // Define a single test case and its expectations.
  test('generatePrivateKey uses the private prefix and sanitized category', () => {
    // Create the key constant.
    const key = generatePrivateKey('License.PNG', 'customer-docs');
    // Assert that the value matches the intended expectation.
    expect(key).toMatch(/^private\/customer-docs\/\d+-[a-f0-9]+\.png$/);
    // Assert that the value matches the intended expectation.
    expect(key.startsWith(KEY_PREFIX)).toBe(true);
  });

  // Define a single test case and its expectations.
  test('rejects traversal and non-private keys', () => {
    // Assert that the value matches the intended expectation.
    expect(isValidPrivateStorageKey('private/customer-docs/ok.bin')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isValidPrivateStorageKey('private/../secret.bin')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(isValidPrivateStorageKey('uploads/private/doc.bin')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(isValidPrivateStorageKey('')).toBe(false);
  });
});
