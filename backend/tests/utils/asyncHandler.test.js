const asyncHandler = require('../../src/utils/asyncHandler');

describe('asyncHandler', () => {
  test('forwards async rejections to next', async () => {
    const error = new Error('async failure');
    const handler = asyncHandler(async () => {
      throw error;
    });
    const next = jest.fn();

    handler({}, {}, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(error);
  });

  test('does not call next when handler resolves', async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.json({ ok: true });
    });
    const res = { json: jest.fn() };
    const next = jest.fn();

    await handler({}, res, next);

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });
});
