// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  deriveComplianceStatus,
  // Contribute this line to the enclosing declaration or statement.
  mapComplianceItem,
// Continue the surrounding logic with this statement.
} = require('../../src/services/sql/carComplianceSqlService');

// Declare a test suite grouping related cases.
describe('carComplianceSqlService', () => {
  // Create the today constant.
  const today = '2026-07-29';

  // Define a single test case and its expectations.
  test('deriveComplianceStatus returns missing when hinted', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call deriveComplianceStatus to perform this step.
      deriveComplianceStatus({ expiresAt: '2027-01-01', statusHint: 'missing', todayStr: today })
    // Continue the surrounding logic with this statement.
    ).toBe('missing');
  });

  // Define a single test case and its expectations.
  test('deriveComplianceStatus returns expired when date is past', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call deriveComplianceStatus to perform this step.
      deriveComplianceStatus({ expiresAt: '2026-01-01', statusHint: 'valid', todayStr: today })
    // Continue the surrounding logic with this statement.
    ).toBe('expired');
  });

  // Define a single test case and its expectations.
  test('deriveComplianceStatus returns valid when date is today or future', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call deriveComplianceStatus to perform this step.
      deriveComplianceStatus({ expiresAt: today, statusHint: null, todayStr: today })
    // Continue the surrounding logic with this statement.
    ).toBe('valid');
    // Assert that the value matches the intended expectation.
    expect(
      // Call deriveComplianceStatus to perform this step.
      deriveComplianceStatus({ expiresAt: '2026-12-01', statusHint: null, todayStr: today })
    // Continue the surrounding logic with this statement.
    ).toBe('valid');
  });

  // Define a single test case and its expectations.
  test('mapComplianceItem uses type label when title is empty', () => {
    // Create the item constant.
    const item = mapComplianceItem({
      // Provide the id field value.
      id: 9,
      // Provide the car id field value.
      car_id: 3,
      // Provide the item type field value.
      item_type: 'vignette',
      // Provide the title field value.
      title: null,
      // Provide the reference number field value.
      reference_number: 'VN-1',
      // Provide the issued at field value.
      issued_at: '2026-01-01',
      // Provide the expires at field value.
      expires_at: '2026-12-31',
      // Provide the notes field value.
      notes: null,
      // Provide the document url field value.
      document_url: null,
      // Provide the status field value.
      status: 'valid',
      // Provide the created by user id field value.
      created_by_user_id: 1,
      // Provide the created at field value.
      created_at: '2026-01-01T00:00:00Z',
      // Provide the updated at field value.
      updated_at: '2026-01-01T00:00:00Z',
    });

    // Assert that the value matches the intended expectation.
    expect(item).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the id field value.
        id: 9,
        // Provide the car id field value.
        carId: '3',
        // Provide the item type field value.
        itemType: 'vignette',
        // Provide the label field value.
        label: 'Винетка',
        // Provide the reference number field value.
        referenceNumber: 'VN-1',
        // Provide the status field value.
        status: 'valid',
      })
    );
  });
});
