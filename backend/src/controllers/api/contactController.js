/**
 * Public contact-form submission handler.
 */
const contactSql = require('../../services/sql/contactSqlService');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
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
  try {
    const { name, email, phone, subject, message } = req.body;
    // Optional phone becomes null so SQL filters stay consistent.
    const contact = await contactSql.createContact({
      name,
      email,
      phone: phone || null,
      subject,
      message,
    });
    return apiResponse.success(res, { contact });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.createContact',
      publicMessage: 'Error submitting contact message.',
    });
  }
});
