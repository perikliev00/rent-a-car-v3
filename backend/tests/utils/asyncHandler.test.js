// Require the '../../src/utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../src/utils/asyncHandler');

// Declare a test suite grouping related cases.
describe('asyncHandler', () => {
  // Define a single test case and its expectations.
  test('forwards async rejections to next', async () => {
    // Create the error constant.
    const error = new Error('async failure');
    // Create the handler constant.
    const handler = asyncHandler(async () => {
      // Throw an error to stop the current control flow.
      throw error;
    });
    // Create the next constant.
    const next = jest.fn();

    // Call handler to perform this step.
    handler({}, {}, next);
    // Wait until the asynchronous operation resolves.
    await Promise.resolve();

    // Assert that the value matches the intended expectation.
    expect(next).toHaveBeenCalledWith(error);
  });

  // Define a single test case and its expectations.
  test('does not call next when handler resolves', async () => {
    // Create the handler constant.
    const handler = asyncHandler(async (_req, res) => {
      // Call res.json to perform this step.
      res.json({ ok: true });
    });
    // Create the res constant.
    const res = { json: jest.fn() };
    // Create the next constant.
    const next = jest.fn();

    // Wait until the asynchronous operation resolves.
    await handler({}, res, next);

    // Assert that the value matches the intended expectation.
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    // Assert that the value matches the intended expectation.
    expect(next).not.toHaveBeenCalled();
  });
});
