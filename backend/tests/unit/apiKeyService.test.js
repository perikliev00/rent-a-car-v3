// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  hashApiKey,
  // Contribute this line to the enclosing declaration or statement.
  generateRawApiKey,
  // Contribute this line to the enclosing declaration or statement.
  keyHasScope,
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_SCOPES,
// Continue the surrounding logic with this statement.
} = require('../../src/services/apiKeyService');

// Declare a test suite grouping related cases.
describe('apiKeyService helpers', () => {
  // Define a single test case and its expectations.
  test('generateRawApiKey uses lux_ prefix', () => {
    // Create the key constant.
    const key = generateRawApiKey();
    // Assert that the value matches the intended expectation.
    expect(key.startsWith('lux_')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(key.length).toBeGreaterThan(20);
  });

  // Define a single test case and its expectations.
  test('hashApiKey is stable sha256 hex', () => {
    // Create the a constant.
    const a = hashApiKey('lux_test');
    // Create the b constant.
    const b = hashApiKey('lux_test');
    // Assert that the value matches the intended expectation.
    expect(a).toBe(b);
    // Assert that the value matches the intended expectation.
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  // Define a single test case and its expectations.
  test('keyHasScope checks scopes array', () => {
    // Assert that the value matches the intended expectation.
    expect(keyHasScope({ scopes: ['cars:read'] }, 'cars:read')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(keyHasScope({ scopes: ['cars:read'] }, 'meta:read')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(keyHasScope(null, 'cars:read')).toBe(false);
  });

  // Define a single test case and its expectations.
  test('ALLOWED_SCOPES includes public read scopes', () => {
    // Assert that the value matches the intended expectation.
    expect(ALLOWED_SCOPES).toEqual(expect.arrayContaining(['cars:read', 'meta:read']));
  });
});
