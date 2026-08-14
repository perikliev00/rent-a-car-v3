const express = require('express');
const { validationResult } = require('express-validator');

async function runValidationRules(rules, { body = {}, query = {}, params = {} } = {}) {
  const req = {
    body,
    query,
    params,
    headers: {},
    get: () => undefined,
  };

  for (const rule of rules) {
    await rule.run(req);
  }

  return validationResult(req);
}

function createValidatorApp(rules, location = 'body') {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.post('/validate', rules, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        errors: errors.array().map((error) => error.msg),
      });
    }
    return res.json({ ok: true, [location]: req[location] });
  });

  return app;
}

module.exports = {
  runValidationRules,
  createValidatorApp,
};
