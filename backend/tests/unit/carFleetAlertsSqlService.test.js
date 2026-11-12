const {
  buildAlertsForCar,
  summarizeAlerts,
  sortAlerts,
} = require('../../src/services/sql/carFleetAlertsSqlService');

describe('carFleetAlertsSqlService builders', () => {
  const today = '2026-07-31';

  test('builds status and service alerts only (no damage/compliance)', () => {
    const alerts = buildAlertsForCar(
      {
        id: 3,
        name: 'BMW',
        status: 'needs_cleaning',
        next_service_date: '2026-07-01',
        unresolved_damage_count: 2,
      },
      today
    );

    expect(alerts.map((a) => a.type)).toEqual(
      expect.arrayContaining(['status_needs_cleaning', 'service_overdue'])
    );
    expect(alerts.map((a) => a.type)).not.toContain('unresolved_damage');
  });

  test('does not emit insurance from car columns', () => {
    const alerts = buildAlertsForCar(
      {
        id: 7,
        name: 'Yaris',
        status: 'available',
        insurance_expiry: '2026-01-01',
        technical_inspection_expiry: '2026-02-01',
        next_service_date: null,
      },
      today
    );
    expect(alerts).toEqual([]);
  });

  test('sortAlerts orders critical before warning before info', () => {
    const sorted = sortAlerts([
      { id: '1', severity: 'info', carName: 'B', type: 'x', carId: '1', message: '' },
      { id: '2', severity: 'critical', carName: 'A', type: 'x', carId: '2', message: '' },
      { id: '3', severity: 'warning', carName: 'C', type: 'x', carId: '3', message: '' },
    ]);
    expect(sorted.map((a) => a.severity)).toEqual(['critical', 'warning', 'info']);
  });

  test('summarizeAlerts counts severities', () => {
    expect(
      summarizeAlerts([
        { severity: 'critical' },
        { severity: 'warning' },
        { severity: 'warning' },
        { severity: 'info' },
      ])
    ).toEqual({ total: 4, critical: 1, warning: 2, info: 1 });
  });
});
