/**
 * SQL for public contact-form submissions (list/create/update status).
 */
const { clientQuery } = require('../../db/transaction');

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

const ALLOWED_STATUSES = ['new', 'ready', 'done'];

/**
 * Normalize id before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeId(value) {
  const id = Number(value);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
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
    return null;
  }

  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
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
  { name, email, phone, subject, message, status = 'new' },
  client = null
) {
  const result = await clientQuery(
    client,
    `
    INSERT INTO contacts (name, email, phone, subject, message, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      name,
      email,
      phone || null,
      subject,
      message,
      ALLOWED_STATUSES.includes(status) ? status : 'new',
    ]
  );

  return mapSqlContact(result.rows[0]);
}

/**
 * List contacts from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listContacts(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT ${CONTACT_SELECT}
    FROM contacts c
    ORDER BY c.created_at DESC
    `
  );

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
  const normalizedId = normalizeId(contactId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedId) {
    return null;
  }

  // Status / lifecycle guard before mutating domain state.
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error('Invalid contact status');
  }

  const result = await clientQuery(
    client,
    `
    UPDATE contacts
    SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [normalizedId, status]
  );

  return mapSqlContact(result.rows[0]) || null;
}

/**
 * Delete contact by id; returns whether a row was affected.
 * @param {string|number} contactId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function deleteContactById(contactId, client = null) {
  const normalizedId = normalizeId(contactId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedId) {
    return false;
  }

  const result = await clientQuery(
    client,
    `DELETE FROM contacts WHERE id = $1 RETURNING id`,
    [normalizedId]
  );

  return result.rowCount > 0;
}

module.exports = {
  ALLOWED_STATUSES,
  mapSqlContact,
  createContact,
  listContacts,
  updateContactStatus,
  deleteContactById,
};
