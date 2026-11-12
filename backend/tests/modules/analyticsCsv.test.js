// Destructure object properties into local variables.
const { toCsv, exportCsv } = require('../../src/modules/analytics/analytics.service');

// Call jest.mock to perform this step.
jest.mock('../../src/modules/analytics/analytics.repository', () => ({
  // Provide the list car performance field value.
  listCarPerformance: jest.fn(),
}));

// Require the '../../src/modules/analytics/analytics.repository' module as repo.
const repo = require('../../src/modules/analytics/analytics.repository');

// Declare a test suite grouping related cases.
describe('spreadsheet-safe CSV export', () => {
  // Define a single test case and its expectations.
  test('neutralizes formula-leading fleet text and keeps numeric negatives', () => {
    // Create the csv constant.
    const csv = toCsv(
      [
        {
          // Provide the car name field value.
          carName: '=1+1',
          // Provide the registration number field value.
          registrationNumber: '+cmd|" /C calc"!A0',
          // Provide the revenue field value.
          revenue: -12.5,
          // Provide the note field value.
          note: ' @SUM(A1)',
        },
      ],
      [
        // Contribute this line to the enclosing declaration or statement.
        { key: 'carName', label: 'car_name', kind: 'text' },
        // Contribute this line to the enclosing declaration or statement.
        { key: 'registrationNumber', label: 'registration_number', kind: 'text' },
        // Contribute this line to the enclosing declaration or statement.
        { key: 'revenue', label: 'revenue', kind: 'number' },
        // Contribute this line to the enclosing declaration or statement.
        { key: 'note', label: 'note', kind: 'text' },
      ]
    );

    // Assert that the value matches the intended expectation.
    expect(csv).toContain("'=1+1");
    // Assert that the value matches the intended expectation.
    expect(csv).toContain("'+cmd");
    // Assert that the value matches the intended expectation.
    expect(csv).toContain('-12.5');
    // Assert that the value matches the intended expectation.
    expect(csv).not.toMatch(/(^|,)=1\+1/);
    // Assert that the value matches the intended expectation.
    expect(csv).toContain("' @SUM(A1)");
  });

  // Define a single test case and its expectations.
  test('quotes separators and control breaks without turning revenue into text', () => {
    // Create the csv constant.
    const csv = toCsv(
      // Contribute this line to the enclosing declaration or statement.
      [{ carName: 'A, "B"\nC', registrationNumber: '-\t1', revenue: 10 }],
      [
        // Contribute this line to the enclosing declaration or statement.
        { key: 'carName', label: 'car_name', kind: 'text' },
        // Contribute this line to the enclosing declaration or statement.
        { key: 'registrationNumber', label: 'registration_number', kind: 'text' },
        // Contribute this line to the enclosing declaration or statement.
        { key: 'revenue', label: 'revenue', kind: 'number' },
      ]
    );
    // Assert that the value matches the intended expectation.
    expect(csv).toContain('"A, ""B""');
    // Assert that the value matches the intended expectation.
    expect(csv).toContain("'-");
    // Assert that the value matches the intended expectation.
    expect(csv).toContain(',10');
  });

  // Define a single test case and its expectations.
  test('exportCsv keeps text literal and revenue numeric for an authorized caller', async () => {
    // Call repo.listCarPerformance.mockResolvedValue to perform this step.
    repo.listCarPerformance.mockResolvedValue([
      {
        // Provide the car id field value.
        carId: '7',
        // Provide the car name field value.
        carName: '=HYPERLINK("http://evil.example")',
        // Provide the registration number field value.
        registrationNumber: '@reg',
        // Provide the revenue field value.
        revenue: -20,
        // Provide the repair cost field value.
        repairCost: 5,
        // Provide the service cost field value.
        serviceCost: 1,
        // Provide the bookings count field value.
        bookingsCount: 2,
        // Provide the booked days field value.
        bookedDays: 3,
        // Provide the maintenance days field value.
        maintenanceDays: 0,
      },
    ]);

    // Create the csv constant.
    const csv = await exportCsv({
      // Provide the from field value.
      from: '2026-07-01',
      // Provide the to field value.
      to: '2026-07-03',
      // Provide the access field value.
      access: {
        // Provide the roles field value.
        roles: ['accountant'],
        // Provide the permissions field value.
        permissions: ['can_export_reports', 'can_view_revenue'],
      },
    });

    // Assert that the value matches the intended expectation.
    expect(csv).toContain("'=HYPERLINK");
    // Assert that the value matches the intended expectation.
    expect(csv).toContain("'@reg");
    // Assert that the value matches the intended expectation.
    expect(csv).toContain('-20');
    // Assert that the value matches the intended expectation.
    expect(csv.split('\n')[0]).toContain('revenue');
  });
});
