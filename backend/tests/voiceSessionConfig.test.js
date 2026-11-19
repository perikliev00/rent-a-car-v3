const { buildSessionConfig } = require('../src/modules/voiceAgent/sessionConfig');
describe('voice session configuration', () => {
  test('is read-only and only exposes the booking search tool', () => {
    const config = buildSessionConfig('bg');
    expect(config.type).toBe('realtime');
    expect(config.tools.map((tool) => tool.name)).toEqual(['search_available_cars']);
    expect(config.tools[0].parameters.required).toContain('pickupLocation');
    expect(config.instructions).toMatch(/never invent availability/i);
  });
  test('supports Bulgarian and English', () => {
    expect(buildSessionConfig('bg').instructions).toContain('Speak Bulgarian');
    expect(buildSessionConfig('en').instructions).toContain('Speak English');
  });
});
