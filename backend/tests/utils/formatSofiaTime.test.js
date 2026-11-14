const { formatSofiaTime, parseSofiaDate } = require('../../src/utils/date/timezone');

describe('formatSofiaTime', () => {
  test.each([
    ['2031-01-15', '14:00'], // winter, UTC+2
    ['2031-07-15', '14:00'], // summer, UTC+3
    ['2031-07-15', '00:00'],
    ['2031-07-15', '23:59'],
    ['2031-07-15', '08:30'],
  ])('round-trips parseSofiaDate(%s, %s)', (date, time) => {
    expect(formatSofiaTime(parseSofiaDate(date, time))).toBe(time);
  });

  test('is not the UTC wall clock', () => {
    expect(formatSofiaTime(new Date('2031-07-15T11:00:00.000Z'))).toBe('14:00');
  });

  test('returns null for invalid input', () => {
    expect(formatSofiaTime('not-a-date')).toBeNull();
  });
});
