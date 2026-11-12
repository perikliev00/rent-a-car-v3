const {
  daysUntilExpiry,
  desiredAlertFromCompliance,
  desiredAlertFromDamage,
  buildDesiredAlerts,
  reconcileFleetAlerts,
  runFleetAlertChecks,
  FLEET_ALERT_EXPIRY_WINDOW_DAYS,
} = require('../../src/services/carFleetAlertReconcileService');

jest.mock('../../src/services/sql/carFleetAlertStoreSqlService', () => ({
  alertKey: (a) => `${a.carId}:${a.type}:${a.sourceKind}:${a.sourceId}`,
  upsertActive: jest.fn(async (a) => ({ ...a, id: String(a.sourceId) })),
  resolveMissing: jest.fn(async () => 0),
  listActive: jest.fn(async () => []),
}));

jest.mock('../../src/db/transaction', () => ({
  clientQuery: jest.fn(),
}));

const storeSql = require('../../src/services/sql/carFleetAlertStoreSqlService');
const { clientQuery } = require('../../src/db/transaction');

describe('carFleetAlertReconcileService', () => {
  const today = '2026-07-31';
  const now = new Date('2026-07-31T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('daysUntilExpiry computes remaining days', () => {
    expect(daysUntilExpiry(today, '2026-08-07')).toBe(7);
    expect(daysUntilExpiry(today, '2026-07-31')).toBe(0);
    expect(daysUntilExpiry(today, '2026-07-20')).toBe(-11);
  });

  test('expiry window is 7 days', () => {
    expect(FLEET_ALERT_EXPIRY_WINDOW_DAYS).toBe(7);
  });

  test('builds warning alert 7 days before insurance expiry', () => {
    const alert = desiredAlertFromCompliance(
      {
        id: 11,
        car_id: 1,
        car_name: 'Golf',
        item_type: 'civil_insurance',
        title: null,
        expires_at: '2026-08-07',
        status: 'valid',
      },
      today
    );

    expect(alert).toEqual(
      expect.objectContaining({
        type: 'insurance_expiring_soon',
        severity: 'warning',
        sourceKind: 'compliance_item',
        sourceId: 11,
      })
    );
    expect(alert.meta.daysUntil).toBe(7);
  });

  test('builds critical alert for already expired document', () => {
    const alert = desiredAlertFromCompliance(
      {
        id: 12,
        car_id: 2,
        car_name: 'BMW',
        item_type: 'civil_insurance',
        title: null,
        expires_at: '2026-01-01',
        status: 'expired',
      },
      today
    );

    expect(alert.type).toBe('insurance_expired');
    expect(alert.severity).toBe('critical');
  });

  test('builds vignette and inspection alerts', () => {
    expect(
      desiredAlertFromCompliance(
        {
          id: 3,
          car_id: 3,
          item_type: 'vignette',
          expires_at: '2026-08-03',
          status: 'valid',
        },
        today
      ).type
    ).toBe('vignette_expiring_soon');

    expect(
      desiredAlertFromCompliance(
        {
          id: 4,
          car_id: 4,
          item_type: 'technical_inspection',
          expires_at: '2026-06-01',
          status: 'valid',
        },
        today
      ).type
    ).toBe('inspection_expired');
  });

  test('builds casco expiring soon alert', () => {
    const alert = desiredAlertFromCompliance(
      {
        id: 8,
        car_id: 8,
        car_name: 'RAV4',
        item_type: 'casco',
        expires_at: '2026-08-01',
        status: 'valid',
      },
      today
    );
    expect(alert.type).toBe('casco_expiring_soon');
    expect(alert.severity).toBe('warning');
  });

  test('ignores documents beyond 7-day window', () => {
    expect(
      desiredAlertFromCompliance(
        {
          id: 5,
          car_id: 5,
          item_type: 'vignette',
          expires_at: '2026-09-01',
          status: 'valid',
        },
        today
      )
    ).toBeNull();
  });

  test('builds alert for unresolved damage', () => {
    const alert = desiredAlertFromDamage({
      id: 99,
      car_id: 7,
      car_name: 'RAV4',
      description: 'Scratch on door',
      status: 'unresolved',
    });
    expect(alert).toEqual(
      expect.objectContaining({
        type: 'unresolved_damage',
        severity: 'warning',
        sourceKind: 'damage_report',
        sourceId: 99,
      })
    );
  });

  test('buildDesiredAlerts aggregates compliance and damage', () => {
    const { desired } = buildDesiredAlerts({
      now,
      complianceRows: [
        {
          id: 1,
          car_id: 1,
          item_type: 'civil_insurance',
          expires_at: '2026-08-07',
          status: 'valid',
        },
      ],
      damageRows: [
        { id: 2, car_id: 1, description: 'dent', status: 'unresolved' },
      ],
    });
    expect(desired.map((d) => d.type)).toEqual([
      'insurance_expiring_soon',
      'unresolved_damage',
    ]);
  });

  test('reconcile upserts desired and resolves missing without duplicates', async () => {
    clientQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            car_id: 1,
            car_name: 'A',
            item_type: 'civil_insurance',
            title: null,
            expires_at: '2026-08-07',
            status: 'valid',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    storeSql.resolveMissing.mockResolvedValue(0);

    const first = await reconcileFleetAlerts({ now });
    expect(first.upserted).toBe(1);
    expect(storeSql.upsertActive).toHaveBeenCalledTimes(1);

    clientQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            car_id: 1,
            car_name: 'A',
            item_type: 'civil_insurance',
            title: null,
            expires_at: '2026-08-07',
            status: 'valid',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await reconcileFleetAlerts({ now });
    expect(storeSql.upsertActive).toHaveBeenCalledTimes(2);
    expect(storeSql.resolveMissing).toHaveBeenCalled();
  });

  test('reconcile resolves alerts when problem no longer applies', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    storeSql.resolveMissing.mockResolvedValue(2);

    const result = await reconcileFleetAlerts({ now });
    expect(result.desired).toBe(0);
    expect(result.resolved).toBe(2);
    expect(storeSql.resolveMissing).toHaveBeenCalledWith(
      expect.any(Set),
      expect.any(Date),
      null
    );
  });

  test('runFleetAlertChecks swallows errors', async () => {
    clientQuery.mockRejectedValue(new Error('db down'));
    const result = await runFleetAlertChecks();
    expect(result).toBeNull();
  });
});
