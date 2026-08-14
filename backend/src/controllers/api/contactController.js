const contactSql = require('../../services/sql/contactSqlService');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');

exports.createContact = asyncHandler(async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;
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
