const { isBackgroundJobsEnabled } = require('../../src/config/backgroundJobs');

describe('isBackgroundJobsEnabled', () => {
  test('defaults to true when unset or empty', () => {
    expect(isBackgroundJobsEnabled(undefined)).toBe(true);
    expect(isBackgroundJobsEnabled(null)).toBe(true);
    expect(isBackgroundJobsEnabled('')).toBe(true);
    expect(isBackgroundJobsEnabled('  ')).toBe(true);
  });

  test('treats explicit falsey values as disabled', () => {
    expect(isBackgroundJobsEnabled('0')).toBe(false);
    expect(isBackgroundJobsEnabled('false')).toBe(false);
    expect(isBackgroundJobsEnabled('FALSE')).toBe(false);
    expect(isBackgroundJobsEnabled('no')).toBe(false);
    expect(isBackgroundJobsEnabled('off')).toBe(false);
  });

  test('treats explicit truthy values as enabled', () => {
    expect(isBackgroundJobsEnabled('1')).toBe(true);
    expect(isBackgroundJobsEnabled('true')).toBe(true);
    expect(isBackgroundJobsEnabled('YES')).toBe(true);
    expect(isBackgroundJobsEnabled('on')).toBe(true);
  });
});
