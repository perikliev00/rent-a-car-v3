const { generatePrivateKey, isValidPrivateStorageKey, KEY_PREFIX } = require('../../../src/services/storage/privateStorageKeys');

describe('privateStorageKeys', () => {
  test('generatePrivateKey uses the private prefix and sanitized category', () => {
    const key = generatePrivateKey('License.PNG', 'customer-docs');
    expect(key).toMatch(/^private\/customer-docs\/\d+-[a-f0-9]+\.png$/);
    expect(key.startsWith(KEY_PREFIX)).toBe(true);
  });

  test('rejects traversal and non-private keys', () => {
    expect(isValidPrivateStorageKey('private/customer-docs/ok.bin')).toBe(true);
    expect(isValidPrivateStorageKey('private/../secret.bin')).toBe(false);
    expect(isValidPrivateStorageKey('uploads/private/doc.bin')).toBe(false);
    expect(isValidPrivateStorageKey('')).toBe(false);
  });
});
