const {
  hashApiKey,
  generateRawApiKey,
  keyHasScope,
  ALLOWED_SCOPES,
} = require('../../src/services/apiKeyService');

describe('apiKeyService helpers', () => {
  test('generateRawApiKey uses lux_ prefix', () => {
    const key = generateRawApiKey();
    expect(key.startsWith('lux_')).toBe(true);
    expect(key.length).toBeGreaterThan(20);
  });

  test('hashApiKey is stable sha256 hex', () => {
    const a = hashApiKey('lux_test');
    const b = hashApiKey('lux_test');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  test('keyHasScope checks scopes array', () => {
    expect(keyHasScope({ scopes: ['cars:read'] }, 'cars:read')).toBe(true);
    expect(keyHasScope({ scopes: ['cars:read'] }, 'meta:read')).toBe(false);
    expect(keyHasScope(null, 'cars:read')).toBe(false);
  });

  test('ALLOWED_SCOPES includes public read scopes', () => {
    expect(ALLOWED_SCOPES).toEqual(expect.arrayContaining(['cars:read', 'meta:read']));
  });
});
