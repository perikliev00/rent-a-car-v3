const {
  incrementStorageErrors,
  setWorkerHeartbeat,
  incrementBackgroundJobFailure,
  setBackgroundJobLastSuccess,
} = require('../../src/monitoring/metrics');
const prometheus = require('../../src/monitoring/prometheus');

describe('metrics facade', () => {
  test('forwards worker and storage helpers to prometheus', () => {
    const spyHeartbeat = jest.spyOn(prometheus, 'setWorkerHeartbeat');
    const spyJobFail = jest.spyOn(prometheus, 'incrementBackgroundJobFailure');
    const spyJobOk = jest.spyOn(prometheus, 'setBackgroundJobLastSuccess');
    const spyStorage = jest.spyOn(prometheus, 'incrementStorageErrors');

    setWorkerHeartbeat(123);
    incrementBackgroundJobFailure('fleet.alerts');
    setBackgroundJobLastSuccess('fleet.alerts', 456);
    incrementStorageErrors('s3', 'read');

    expect(spyHeartbeat).toHaveBeenCalledWith(123);
    expect(spyJobFail).toHaveBeenCalledWith('fleet.alerts');
    expect(spyJobOk).toHaveBeenCalledWith('fleet.alerts', 456);
    expect(spyStorage).toHaveBeenCalledWith('s3', 'read');

    spyHeartbeat.mockRestore();
    spyJobFail.mockRestore();
    spyJobOk.mockRestore();
    spyStorage.mockRestore();
  });
});
