// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildAlertsForCar,
  // Contribute this line to the enclosing declaration or statement.
  summarizeAlerts,
  // Contribute this line to the enclosing declaration or statement.
  sortAlerts,
// Continue the surrounding logic with this statement.
} = require('../../src/services/sql/carFleetAlertsSqlService');

// Declare a test suite grouping related cases.
describe('carFleetAlertsSqlService builders', () => {
  // Create the today constant.
  const today = '2026-07-31';

  // Define a single test case and its expectations.
  test('builds status and service alerts only (no damage/compliance)', () => {
    // Create the alerts constant.
    const alerts = buildAlertsForCar(
      {
        // Provide the id field value.
        id: 3,
        // Provide the name field value.
        name: 'BMW',
        // Provide the status field value.
        status: 'needs_cleaning',
        // Provide the next service date field value.
        next_service_date: '2026-07-01',
        // Provide the unresolved damage count field value.
        unresolved_damage_count: 2,
      },
      // Reference the identifier used by the enclosing expression.
      today
    );

    // Assert that the value matches the intended expectation.
    expect(alerts.map((a) => a.type)).toEqual(
      // Call expect.arrayContaining to perform this step.
      expect.arrayContaining(['status_needs_cleaning', 'service_overdue'])
    );
    // Assert that the value matches the intended expectation.
    expect(alerts.map((a) => a.type)).not.toContain('unresolved_damage');
  });

  // Define a single test case and its expectations.
  test('does not emit insurance from car columns', () => {
    // Create the alerts constant.
    const alerts = buildAlertsForCar(
      {
        // Provide the id field value.
        id: 7,
        // Provide the name field value.
        name: 'Yaris',
        // Provide the status field value.
        status: 'available',
        // Provide the insurance expiry field value.
        insurance_expiry: '2026-01-01',
        // Provide the technical inspection expiry field value.
        technical_inspection_expiry: '2026-02-01',
        // Provide the next service date field value.
        next_service_date: null,
      },
      // Reference the identifier used by the enclosing expression.
      today
    );
    // Assert that the value matches the intended expectation.
    expect(alerts).toEqual([]);
  });

  // Define a single test case and its expectations.
  test('sortAlerts orders critical before warning before info', () => {
    // Create the sorted constant.
    const sorted = sortAlerts([
      // Contribute this line to the enclosing declaration or statement.
      { id: '1', severity: 'info', carName: 'B', type: 'x', carId: '1', message: '' },
      // Contribute this line to the enclosing declaration or statement.
      { id: '2', severity: 'critical', carName: 'A', type: 'x', carId: '2', message: '' },
      // Contribute this line to the enclosing declaration or statement.
      { id: '3', severity: 'warning', carName: 'C', type: 'x', carId: '3', message: '' },
    ]);
    // Assert that the value matches the intended expectation.
    expect(sorted.map((a) => a.severity)).toEqual(['critical', 'warning', 'info']);
  });

  // Define a single test case and its expectations.
  test('summarizeAlerts counts severities', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call summarizeAlerts to perform this step.
      summarizeAlerts([
        // Contribute this line to the enclosing declaration or statement.
        { severity: 'critical' },
        // Contribute this line to the enclosing declaration or statement.
        { severity: 'warning' },
        // Contribute this line to the enclosing declaration or statement.
        { severity: 'warning' },
        // Contribute this line to the enclosing declaration or statement.
        { severity: 'info' },
      ])
    // Continue the surrounding logic with this statement.
    ).toEqual({ total: 4, critical: 1, warning: 2, info: 1 });
  });
});
