const { getOpenApiDocument, resetOpenApiCache } = require('../src/config/openapi');

describe('OpenAPI document', () => {
  beforeAll(() => {
    resetOpenApiCache();
  });

  test('builds merged spec with required domains', () => {
    const doc = getOpenApiDocument();
    expect(doc.openapi).toBe('3.0.3');
    expect(doc.info.title).toBe('LuxRide API');
    expect(doc.paths['/api/v1/auth/login']).toBeDefined();
    expect(doc.paths['/api/v1/auth/verify-email']).toBeDefined();
    expect(doc.paths['/api/v1/auth/resend-verification']).toBeDefined();
    expect(doc.paths['/api/v1/cars']).toBeDefined();
    expect(doc.paths['/api/v1/admin/calendar/events']).toBeDefined();
    expect(doc.paths['/api/v1/admin/cars']).toBeDefined();
    expect(doc.paths['/api/v1/admin/analytics/overview']).toBeDefined();
    expect(doc.paths['/api/v1/admin/api-keys']).toBeDefined();
    expect(doc.paths['/webhook/stripe']).toBeDefined();
    expect(doc.components.schemas.ApiError).toBeDefined();
    expect(doc.components.securitySchemes.apiKeyHeader).toBeDefined();
  });
});
