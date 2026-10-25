const { toCsv, exportCsv } = require('../../src/modules/analytics/analytics.service');

jest.mock('../../src/modules/analytics/analytics.repository', () => ({
  listCarPerformance: jest.fn(),
}));

const repo = require('../../src/modules/analytics/analytics.repository');

describe('spreadsheet-safe CSV export', () => {
  test('neutralizes formula-leading fleet text and keeps numeric negatives', () => {
    const csv = toCsv(
      [
        {
          carName: '=1+1',
          registrationNumber: '+cmd|" /C calc"!A0',
          revenue: -12.5,
          note: ' @SUM(A1)',
        },
      ],
      [
        { key: 'carName', label: 'car_name', kind: 'text' },
        { key: 'registrationNumber', label: 'registration_number', kind: 'text' },
        { key: 'revenue', label: 'revenue', kind: 'number' },
        { key: 'note', label: 'note', kind: 'text' },
      ]
    );

    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain('-12.5');
    expect(csv).not.toMatch(/(^|,)=1\+1/);
    expect(csv).toContain("' @SUM(A1)");
  });

  test('quotes separators and control breaks without turning revenue into text', () => {
    const csv = toCsv(
      [{ carName: 'A, "B"\nC', registrationNumber: '-\t1', revenue: 10 }],
      [
        { key: 'carName', label: 'car_name', kind: 'text' },
        { key: 'registrationNumber', label: 'registration_number', kind: 'text' },
        { key: 'revenue', label: 'revenue', kind: 'number' },
      ]
    );
    expect(csv).toContain('"A, ""B""');
    expect(csv).toContain("'-");
    expect(csv).toContain(',10');
  });

  test('exportCsv keeps text literal and revenue numeric for an authorized caller', async () => {
    repo.listCarPerformance.mockResolvedValue([
      {
        carId: '7',
        carName: '=HYPERLINK("http://evil.example")',
        registrationNumber: '@reg',
        revenue: -20,
        repairCost: 5,
        serviceCost: 1,
        bookingsCount: 2,
        bookedDays: 3,
        maintenanceDays: 0,
      },
    ]);

    const csv = await exportCsv({
      from: '2026-07-01',
      to: '2026-07-03',
      access: {
        roles: ['accountant'],
        permissions: ['can_export_reports', 'can_view_revenue'],
      },
    });

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@reg");
    expect(csv).toContain('-20');
    expect(csv.split('\n')[0]).toContain('revenue');
  });
});
