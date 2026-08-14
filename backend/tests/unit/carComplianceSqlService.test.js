const {
  deriveComplianceStatus,
  mapComplianceItem,
} = require('../../src/services/sql/carComplianceSqlService');

describe('carComplianceSqlService', () => {
  const today = '2026-07-29';

  test('deriveComplianceStatus returns missing when hinted', () => {
    expect(
      deriveComplianceStatus({ expiresAt: '2027-01-01', statusHint: 'missing', todayStr: today })
    ).toBe('missing');
  });

  test('deriveComplianceStatus returns expired when date is past', () => {
    expect(
      deriveComplianceStatus({ expiresAt: '2026-01-01', statusHint: 'valid', todayStr: today })
    ).toBe('expired');
  });

  test('deriveComplianceStatus returns valid when date is today or future', () => {
    expect(
      deriveComplianceStatus({ expiresAt: today, statusHint: null, todayStr: today })
    ).toBe('valid');
    expect(
      deriveComplianceStatus({ expiresAt: '2026-12-01', statusHint: null, todayStr: today })
    ).toBe('valid');
  });

  test('mapComplianceItem uses type label when title is empty', () => {
    const item = mapComplianceItem({
      id: 9,
      car_id: 3,
      item_type: 'vignette',
      title: null,
      reference_number: 'VN-1',
      issued_at: '2026-01-01',
      expires_at: '2026-12-31',
      notes: null,
      document_url: null,
      status: 'valid',
      created_by_user_id: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    expect(item).toEqual(
      expect.objectContaining({
        id: 9,
        carId: '3',
        itemType: 'vignette',
        label: 'Винетка',
        referenceNumber: 'VN-1',
        status: 'valid',
      })
    );
  });
});
