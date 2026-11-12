// Require the 'express' module as express.
const express = require('express');
// Destructure object properties into local variables.
const { validationResult } = require('express-validator');

// Define the async function runValidationRules.
async function runValidationRules(rules, { body = {}, query = {}, params = {} } = {}) {
  // Create the req constant.
  const req = {
    // Contribute this line to the enclosing declaration or statement.
    body,
    // Contribute this line to the enclosing declaration or statement.
    query,
    // Contribute this line to the enclosing declaration or statement.
    params,
    // Provide the headers field value.
    headers: {},
    // Provide the get field value.
    get: () => undefined,
  };

  // Iterate using the loop initializer, condition, and step.
  for (const rule of rules) {
    // Wait until the asynchronous operation resolves.
    await rule.run(req);
  }

  // Return the resulting value to the caller.
  return validationResult(req);
}

// Define the createValidatorApp function.
function createValidatorApp(rules, location = 'body') {
  // Create the app constant.
  const app = express();
  // Call app.use to perform this step.
  app.use(express.json());
  // Call app.use to perform this step.
  app.use(express.urlencoded({ extended: true }));

  // Call app.post to perform this step.
  app.post('/validate', rules, (req, res) => {
    // Create the errors constant.
    const errors = validationResult(req);
    // Evaluate the condition and enter the branch when it is true.
    if (!errors.isEmpty()) {
      // Return the resulting value to the caller.
      return res.status(422).json({
        // Provide the errors field value.
        errors: errors.array().map((error) => error.msg),
      });
    }
    // Return the resulting value to the caller.
    return res.json({ ok: true, [location]: req[location] });
  });

  // Return the resulting value to the caller.
  return app;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  runValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  createValidatorApp,
};
