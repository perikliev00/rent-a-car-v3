// Destructure object properties into local variables.
const { isBackgroundJobsEnabled } = require('../../src/config/backgroundJobs');

// Declare a test suite grouping related cases.
describe('isBackgroundJobsEnabled', () => {
  // Define a single test case and its expectations.
  test('defaults to true when unset or empty', () => {
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled(undefined)).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled(null)).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('  ')).toBe(true);
  });

  // Define a single test case and its expectations.
  test('treats explicit falsey values as disabled', () => {
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('0')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('false')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('FALSE')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('no')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('off')).toBe(false);
  });

  // Define a single test case and its expectations.
  test('treats explicit truthy values as enabled', () => {
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('1')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('true')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('YES')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isBackgroundJobsEnabled('on')).toBe(true);
  });
});
