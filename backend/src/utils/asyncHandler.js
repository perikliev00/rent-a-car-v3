/**
 * Express async handler wrapper — forwards promise rejections to error middleware via `next`.
 */

/**
 * Wraps an async route/controller handler so thrown errors and rejected promises reach `next`.
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => unknown} handler
 * @returns {import('express').RequestHandler}
 * @throws {never} Errors from `handler` are forwarded to `next`, not thrown synchronously
 */
function asyncHandler(handler) {
  return function wrappedAsyncHandler(req, res, next) {
    // Promise.resolve ensures the result is a Promise; .catch(next) forwards failures to Express.
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
