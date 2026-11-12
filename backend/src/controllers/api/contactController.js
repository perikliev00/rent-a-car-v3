/**
 * Public contact-form submission handler.
 */
const contactSql = require('../../services/sql/contactSqlService');
// Require the '../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../utils/apiResponse');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../utils/controllerError');

/**
 * Create a public contact-form message for staff follow-up.
 * Side effects: inserts a contact row in the database.
 * @param {import('express').Request} req - Body: name, email, phone?, subject, message
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.createContact = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { name, email, phone, subject, message } = req.body;
    // Optional phone becomes null so SQL filters stay consistent.
    const contact = await contactSql.createContact({
      // Contribute this line to the enclosing declaration or statement.
      name,
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Provide the phone field value.
      phone: phone || null,
      // Contribute this line to the enclosing declaration or statement.
      subject,
      // Contribute this line to the enclosing declaration or statement.
      message,
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { contact });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.createContact',
      // Provide the public message field value.
      publicMessage: 'Error submitting contact message.',
    });
  }
});
