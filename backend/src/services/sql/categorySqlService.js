/**
 * SQL for vehicle categories used in fleet pricing/grouping.
 */
const pool = require('../../db/pool');

/**
 * List categories from SQL.
 * @returns {Promise<*>}
 */
async function listCategories() {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT id, name
    FROM categories
    ORDER BY name ASC
    `
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => ({
    // Provide the id field value.
    id: Number(row.id),
    // Provide the name field value.
    name: row.name,
  }));
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listCategories,
};
