// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  incrementStorageErrors,
  // Contribute this line to the enclosing declaration or statement.
  setWorkerHeartbeat,
  // Contribute this line to the enclosing declaration or statement.
  incrementBackgroundJobFailure,
  // Contribute this line to the enclosing declaration or statement.
  setBackgroundJobLastSuccess,
// Continue the surrounding logic with this statement.
} = require('../../src/monitoring/metrics');
// Require the '../../src/monitoring/prometheus' module as prometheus.
const prometheus = require('../../src/monitoring/prometheus');

// Declare a test suite grouping related cases.
describe('metrics facade', () => {
  // Define a single test case and its expectations.
  test('forwards worker and storage helpers to prometheus', () => {
    // Create the spy heartbeat constant.
    const spyHeartbeat = jest.spyOn(prometheus, 'setWorkerHeartbeat');
    // Create the spy job fail constant.
    const spyJobFail = jest.spyOn(prometheus, 'incrementBackgroundJobFailure');
    // Create the spy job ok constant.
    const spyJobOk = jest.spyOn(prometheus, 'setBackgroundJobLastSuccess');
    // Create the spy storage constant.
    const spyStorage = jest.spyOn(prometheus, 'incrementStorageErrors');

    // Call setWorkerHeartbeat to perform this step.
    setWorkerHeartbeat(123);
    // Call incrementBackgroundJobFailure to perform this step.
    incrementBackgroundJobFailure('fleet.alerts');
    // Call setBackgroundJobLastSuccess to perform this step.
    setBackgroundJobLastSuccess('fleet.alerts', 456);
    // Call incrementStorageErrors to perform this step.
    incrementStorageErrors('s3', 'read');

    // Assert that the value matches the intended expectation.
    expect(spyHeartbeat).toHaveBeenCalledWith(123);
    // Assert that the value matches the intended expectation.
    expect(spyJobFail).toHaveBeenCalledWith('fleet.alerts');
    // Assert that the value matches the intended expectation.
    expect(spyJobOk).toHaveBeenCalledWith('fleet.alerts', 456);
    // Assert that the value matches the intended expectation.
    expect(spyStorage).toHaveBeenCalledWith('s3', 'read');

    // Call spyHeartbeat.mockRestore to perform this step.
    spyHeartbeat.mockRestore();
    // Call spyJobFail.mockRestore to perform this step.
    spyJobFail.mockRestore();
    // Call spyJobOk.mockRestore to perform this step.
    spyJobOk.mockRestore();
    // Call spyStorage.mockRestore to perform this step.
    spyStorage.mockRestore();
  });
});
