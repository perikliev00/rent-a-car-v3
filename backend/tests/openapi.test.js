// Destructure object properties into local variables.
const { getOpenApiDocument, resetOpenApiCache } = require('../src/config/openapi');

// Declare a test suite grouping related cases.
describe('OpenAPI document', () => {
  // Register setup that runs before the tests.
  beforeAll(() => {
    // Call resetOpenApiCache to perform this step.
    resetOpenApiCache();
  });

  // Define a single test case and its expectations.
  test('builds merged spec with required domains', () => {
    // Create the doc constant.
    const doc = getOpenApiDocument();
    // Assert that the value matches the intended expectation.
    expect(doc.openapi).toBe('3.0.3');
    // Assert that the value matches the intended expectation.
    expect(doc.info.title).toBe('LuxRide API');
    // Assert that the value matches the intended expectation.
    expect(doc.paths['/api/v1/auth/login']).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(doc.paths['/api/v1/auth/verify-email']).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(doc.paths['/api/v1/auth/resend-verification']).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(doc.paths['/api/v1/cars']).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(doc.paths['/api/v1/admin/calendar/events']).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(doc.paths['/api/v1/admin/cars']).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(doc.paths['/api/v1/admin/analytics/overview']).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(doc.paths['/api/v1/admin/api-keys']).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(doc.paths['/webhook/stripe']).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(doc.components.schemas.ApiError).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(doc.components.securitySchemes.apiKeyHeader).toBeDefined();
  });
});
