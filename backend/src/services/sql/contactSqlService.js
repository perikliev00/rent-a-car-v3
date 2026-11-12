/**
 * SQL for public contact-form submissions (list/create/update status).
 */
const { clientQuery } = require('../../db/transaction');

// Create the contact select constant.
const CONTACT_SELECT = `
  c.id,
  c.name,
  c.email,
  c.phone,
  c.subject,
  c.message,
  c.status,
  c.created_at,
  c.updated_at
`;

// Create the allowed statuses constant.
const ALLOWED_STATUSES = ['new', 'ready', 'done'];

/**
 * Normalize id before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeId(value) {
  // Create the id constant.
  const id = Number(value);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
  return id;
}

/**
 * Map a DB/API row into the domain shape used by callers (mapSqlContact).
 * @param {object} row
 * @returns {*}
 */
function mapSqlContact(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the name field value.
    name: row.name,
    // Provide the email field value.
    email: row.email,
    // Provide the phone field value.
    phone: row.phone || undefined,
    // Provide the subject field value.
    subject: row.subject,
    // Provide the message field value.
    message: row.message,
    // Provide the status field value.
    status: row.status,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
  };
}

/**
 * Insert a public contact-form submission (invalid status coerced to 'new').
 * @param {object} params
 * @param {object|null} [client]
 * @returns {Promise<object>}
 */
async function createContact(
  // Continue the surrounding logic with this statement.
  { name, email, phone, subject, message, status = 'new' },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO contacts (name, email, phone, subject, message, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      name,
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Contribute this line to the enclosing declaration or statement.
      phone || null,
      // Contribute this line to the enclosing declaration or statement.
      subject,
      // Contribute this line to the enclosing declaration or statement.
      message,
      // Call ALLOWED_STATUSES.includes to perform this step.
      ALLOWED_STATUSES.includes(status) ? status : 'new',
    ]
  );

  // Return the resulting value to the caller.
  return mapSqlContact(result.rows[0]);
}

/**
 * List contacts from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listContacts(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${CONTACT_SELECT}
    FROM contacts c
    ORDER BY c.created_at DESC
    `
  );

  // Return the resulting value to the caller.
  return result.rows.map(mapSqlContact);
}

/**
 * Update or upsert contact status; returns null when not found.
 * @param {string|number} contactId
 * @param {string} status
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function updateContactStatus(contactId, status, client = null) {
  // Create the normalized id constant.
  const normalizedId = normalizeId(contactId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Status / lifecycle guard before mutating domain state.
  if (!ALLOWED_STATUSES.includes(status)) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid contact status');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE contacts
    SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedId, status]
  );

  // Return the resulting value to the caller.
  return mapSqlContact(result.rows[0]) || null;
}

/**
 * Delete contact by id; returns whether a row was affected.
 * @param {string|number} contactId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function deleteContactById(contactId, client = null) {
  // Create the normalized id constant.
  const normalizedId = normalizeId(contactId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedId) {
    // Return the resulting value to the caller.
    return false;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `DELETE FROM contacts WHERE id = $1 RETURNING id`,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedId]
  );

  // Return the resulting value to the caller.
  return result.rowCount > 0;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  mapSqlContact,
  // Contribute this line to the enclosing declaration or statement.
  createContact,
  // Contribute this line to the enclosing declaration or statement.
  listContacts,
  // Contribute this line to the enclosing declaration or statement.
  updateContactStatus,
  // Contribute this line to the enclosing declaration or statement.
  deleteContactById,
};
