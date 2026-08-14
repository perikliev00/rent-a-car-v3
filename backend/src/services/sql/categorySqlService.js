const pool = require('../../db/pool');

async function listCategories() {
  const result = await pool.query(
    `
    SELECT id, name
    FROM categories
    ORDER BY name ASC
    `
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
  }));
}

module.exports = {
  listCategories,
};
