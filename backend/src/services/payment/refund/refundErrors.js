function refundError(code, message, status = 422) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

module.exports = { refundError };
