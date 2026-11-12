// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  daysUntilExpiry,
  // Contribute this line to the enclosing declaration or statement.
  desiredAlertFromCompliance,
  // Contribute this line to the enclosing declaration or statement.
  desiredAlertFromDamage,
  // Contribute this line to the enclosing declaration or statement.
  buildDesiredAlerts,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  runFleetAlertChecks,
  // Contribute this line to the enclosing declaration or statement.
  FLEET_ALERT_EXPIRY_WINDOW_DAYS,
// Continue the surrounding logic with this statement.
} = require('../../src/services/carFleetAlertReconcileService');

// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/carFleetAlertStoreSqlService', () => ({
  // Provide the alert key field value.
  alertKey: (a) => `${a.carId}:${a.type}:${a.sourceKind}:${a.sourceId}`,
  // Provide the upsert active field value.
  upsertActive: jest.fn(async (a) => ({ ...a, id: String(a.sourceId) })),
  // Provide the resolve missing field value.
  resolveMissing: jest.fn(async () => 0),
  // Provide the list active field value.
  listActive: jest.fn(async () => []),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/db/transaction', () => ({
  // Provide the client query field value.
  clientQuery: jest.fn(),
}));

// Require the '../../src/services/sql/carFleetAlertStoreSqlService' module as storeSql.
const storeSql = require('../../src/services/sql/carFleetAlertStoreSqlService');
// Destructure object properties into local variables.
const { clientQuery } = require('../../src/db/transaction');

// Declare a test suite grouping related cases.
describe('carFleetAlertReconcileService', () => {
  // Create the today constant.
  const today = '2026-07-31';
  // Create the now constant.
  const now = new Date('2026-07-31T12:00:00Z');

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('daysUntilExpiry computes remaining days', () => {
    // Assert that the value matches the intended expectation.
    expect(daysUntilExpiry(today, '2026-08-07')).toBe(7);
    // Assert that the value matches the intended expectation.
    expect(daysUntilExpiry(today, '2026-07-31')).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(daysUntilExpiry(today, '2026-07-20')).toBe(-11);
  });

  // Define a single test case and its expectations.
  test('expiry window is 7 days', () => {
    // Assert that the value matches the intended expectation.
    expect(FLEET_ALERT_EXPIRY_WINDOW_DAYS).toBe(7);
  });

  // Define a single test case and its expectations.
  test('builds warning alert 7 days before insurance expiry', () => {
    // Create the alert constant.
    const alert = desiredAlertFromCompliance(
      {
        // Provide the id field value.
        id: 11,
        // Provide the car id field value.
        car_id: 1,
        // Provide the car name field value.
        car_name: 'Golf',
        // Provide the item type field value.
        item_type: 'civil_insurance',
        // Provide the title field value.
        title: null,
        // Provide the expires at field value.
        expires_at: '2026-08-07',
        // Provide the status field value.
        status: 'valid',
      },
      // Reference the identifier used by the enclosing expression.
      today
    );

    // Assert that the value matches the intended expectation.
    expect(alert).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the type field value.
        type: 'insurance_expiring_soon',
        // Provide the severity field value.
        severity: 'warning',
        // Provide the source kind field value.
        sourceKind: 'compliance_item',
        // Provide the source id field value.
        sourceId: 11,
      })
    );
    // Assert that the value matches the intended expectation.
    expect(alert.meta.daysUntil).toBe(7);
  });

  // Define a single test case and its expectations.
  test('builds critical alert for already expired document', () => {
    // Create the alert constant.
    const alert = desiredAlertFromCompliance(
      {
        // Provide the id field value.
        id: 12,
        // Provide the car id field value.
        car_id: 2,
        // Provide the car name field value.
        car_name: 'BMW',
        // Provide the item type field value.
        item_type: 'civil_insurance',
        // Provide the title field value.
        title: null,
        // Provide the expires at field value.
        expires_at: '2026-01-01',
        // Provide the status field value.
        status: 'expired',
      },
      // Reference the identifier used by the enclosing expression.
      today
    );

    // Assert that the value matches the intended expectation.
    expect(alert.type).toBe('insurance_expired');
    // Assert that the value matches the intended expectation.
    expect(alert.severity).toBe('critical');
  });

  // Define a single test case and its expectations.
  test('builds vignette and inspection alerts', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call desiredAlertFromCompliance to perform this step.
      desiredAlertFromCompliance(
        {
          // Provide the id field value.
          id: 3,
          // Provide the car id field value.
          car_id: 3,
          // Provide the item type field value.
          item_type: 'vignette',
          // Provide the expires at field value.
          expires_at: '2026-08-03',
          // Provide the status field value.
          status: 'valid',
        },
        // Reference the identifier used by the enclosing expression.
        today
      // Continue the surrounding logic with this statement.
      ).type
    // Continue the surrounding logic with this statement.
    ).toBe('vignette_expiring_soon');

    // Assert that the value matches the intended expectation.
    expect(
      // Call desiredAlertFromCompliance to perform this step.
      desiredAlertFromCompliance(
        {
          // Provide the id field value.
          id: 4,
          // Provide the car id field value.
          car_id: 4,
          // Provide the item type field value.
          item_type: 'technical_inspection',
          // Provide the expires at field value.
          expires_at: '2026-06-01',
          // Provide the status field value.
          status: 'valid',
        },
        // Reference the identifier used by the enclosing expression.
        today
      // Continue the surrounding logic with this statement.
      ).type
    // Continue the surrounding logic with this statement.
    ).toBe('inspection_expired');
  });

  // Define a single test case and its expectations.
  test('builds casco expiring soon alert', () => {
    // Create the alert constant.
    const alert = desiredAlertFromCompliance(
      {
        // Provide the id field value.
        id: 8,
        // Provide the car id field value.
        car_id: 8,
        // Provide the car name field value.
        car_name: 'RAV4',
        // Provide the item type field value.
        item_type: 'casco',
        // Provide the expires at field value.
        expires_at: '2026-08-01',
        // Provide the status field value.
        status: 'valid',
      },
      // Reference the identifier used by the enclosing expression.
      today
    );
    // Assert that the value matches the intended expectation.
    expect(alert.type).toBe('casco_expiring_soon');
    // Assert that the value matches the intended expectation.
    expect(alert.severity).toBe('warning');
  });

  // Define a single test case and its expectations.
  test('ignores documents beyond 7-day window', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call desiredAlertFromCompliance to perform this step.
      desiredAlertFromCompliance(
        {
          // Provide the id field value.
          id: 5,
          // Provide the car id field value.
          car_id: 5,
          // Provide the item type field value.
          item_type: 'vignette',
          // Provide the expires at field value.
          expires_at: '2026-09-01',
          // Provide the status field value.
          status: 'valid',
        },
        // Reference the identifier used by the enclosing expression.
        today
      )
    // Continue the surrounding logic with this statement.
    ).toBeNull();
  });

  // Define a single test case and its expectations.
  test('builds alert for unresolved damage', () => {
    // Create the alert constant.
    const alert = desiredAlertFromDamage({
      // Provide the id field value.
      id: 99,
      // Provide the car id field value.
      car_id: 7,
      // Provide the car name field value.
      car_name: 'RAV4',
      // Provide the description field value.
      description: 'Scratch on door',
      // Provide the status field value.
      status: 'unresolved',
    });
    // Assert that the value matches the intended expectation.
    expect(alert).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the type field value.
        type: 'unresolved_damage',
        // Provide the severity field value.
        severity: 'warning',
        // Provide the source kind field value.
        sourceKind: 'damage_report',
        // Provide the source id field value.
        sourceId: 99,
      })
    );
  });

  // Define a single test case and its expectations.
  test('buildDesiredAlerts aggregates compliance and damage', () => {
    // Destructure object properties into local variables.
    const { desired } = buildDesiredAlerts({
      // Contribute this line to the enclosing declaration or statement.
      now,
      // Provide the compliance rows field value.
      complianceRows: [
        {
          // Provide the id field value.
          id: 1,
          // Provide the car id field value.
          car_id: 1,
          // Provide the item type field value.
          item_type: 'civil_insurance',
          // Provide the expires at field value.
          expires_at: '2026-08-07',
          // Provide the status field value.
          status: 'valid',
        },
      ],
      // Provide the damage rows field value.
      damageRows: [
        // Contribute this line to the enclosing declaration or statement.
        { id: 2, car_id: 1, description: 'dent', status: 'unresolved' },
      ],
    });
    // Assert that the value matches the intended expectation.
    expect(desired.map((d) => d.type)).toEqual([
      // Supply the literal value used by the enclosing expression.
      'insurance_expiring_soon',
      // Supply the literal value used by the enclosing expression.
      'unresolved_damage',
    ]);
  });

  // Define a single test case and its expectations.
  test('reconcile upserts desired and resolves missing without duplicates', async () => {
    // Reference the identifier used by the enclosing expression.
    clientQuery
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({
        // Provide the rows field value.
        rows: [
          {
            // Provide the id field value.
            id: 1,
            // Provide the car id field value.
            car_id: 1,
            // Provide the car name field value.
            car_name: 'A',
            // Provide the item type field value.
            item_type: 'civil_insurance',
            // Provide the title field value.
            title: null,
            // Provide the expires at field value.
            expires_at: '2026-08-07',
            // Provide the status field value.
            status: 'valid',
          },
        ],
      })
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({ rows: [] });

    // Call storeSql.resolveMissing.mockResolvedValue to perform this step.
    storeSql.resolveMissing.mockResolvedValue(0);

    // Create the first constant.
    const first = await reconcileFleetAlerts({ now });
    // Assert that the value matches the intended expectation.
    expect(first.upserted).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(storeSql.upsertActive).toHaveBeenCalledTimes(1);

    // Reference the identifier used by the enclosing expression.
    clientQuery
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({
        // Provide the rows field value.
        rows: [
          {
            // Provide the id field value.
            id: 1,
            // Provide the car id field value.
            car_id: 1,
            // Provide the car name field value.
            car_name: 'A',
            // Provide the item type field value.
            item_type: 'civil_insurance',
            // Provide the title field value.
            title: null,
            // Provide the expires at field value.
            expires_at: '2026-08-07',
            // Provide the status field value.
            status: 'valid',
          },
        ],
      })
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({ rows: [] });

    // Wait until the asynchronous operation resolves.
    await reconcileFleetAlerts({ now });
    // Assert that the value matches the intended expectation.
    expect(storeSql.upsertActive).toHaveBeenCalledTimes(2);
    // Assert that the value matches the intended expectation.
    expect(storeSql.resolveMissing).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('reconcile resolves alerts when problem no longer applies', async () => {
    // Reference the identifier used by the enclosing expression.
    clientQuery
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({ rows: [] })
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({ rows: [] });
    // Call storeSql.resolveMissing.mockResolvedValue to perform this step.
    storeSql.resolveMissing.mockResolvedValue(2);

    // Create the result constant.
    const result = await reconcileFleetAlerts({ now });
    // Assert that the value matches the intended expectation.
    expect(result.desired).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(result.resolved).toBe(2);
    // Assert that the value matches the intended expectation.
    expect(storeSql.resolveMissing).toHaveBeenCalledWith(
      // Call expect.any to perform this step.
      expect.any(Set),
      // Call expect.any to perform this step.
      expect.any(Date),
      // Supply the literal value used by the enclosing expression.
      null
    );
  });

  // Define a single test case and its expectations.
  test('runFleetAlertChecks swallows errors', async () => {
    // Call clientQuery.mockRejectedValue to perform this step.
    clientQuery.mockRejectedValue(new Error('db down'));
    // Create the result constant.
    const result = await runFleetAlertChecks();
    // Assert that the value matches the intended expectation.
    expect(result).toBeNull();
  });
});
