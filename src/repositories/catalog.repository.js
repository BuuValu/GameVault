const pool = require('../config/db');

function createCatalogRepository({ table, primaryKey, usageTable, usageField }) {
    const columns = `catalog_item.${primaryKey}, catalog_item.name,
        (SELECT COUNT(*) FROM ${usageTable} AS catalog_usage
          WHERE catalog_usage.${primaryKey} = catalog_item.${primaryKey}) AS ${usageField}`;

    async function list() {
        const [rows] = await pool.execute(
            `SELECT ${columns} FROM ${table} AS catalog_item ORDER BY catalog_item.name`
        );
        return rows;
    }

    async function findById(id) {
        const [rows] = await pool.execute(
            `SELECT ${columns} FROM ${table} AS catalog_item WHERE catalog_item.${primaryKey} = ?`,
            [id]
        );
        return rows[0] || null;
    }

    async function findByName(name) {
        const [rows] = await pool.execute(
            `SELECT ${primaryKey}, name FROM ${table} WHERE name = ?`,
            [name]
        );
        return rows[0] || null;
    }

    async function create(name) {
        const [result] = await pool.execute(
            `INSERT INTO ${table} (name) VALUES (?)`,
            [name]
        );
        return findById(result.insertId);
    }

    async function update(id, name) {
        await pool.execute(
            `UPDATE ${table} SET name = ? WHERE ${primaryKey} = ?`,
            [name, id]
        );
        return findById(id);
    }

    async function remove(id) {
        const [result] = await pool.execute(
            `DELETE FROM ${table} WHERE ${primaryKey} = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async function findExistingIds(ids) {
        if (ids.length === 0) {
            return [];
        }

        const [rows] = await pool.query(
            `SELECT ${primaryKey} FROM ${table} WHERE ${primaryKey} IN (?)`,
            [ids]
        );
        return rows.map((row) => row[primaryKey]);
    }

    return {
        list,
        findById,
        findByName,
        create,
        update,
        remove,
        findExistingIds
    };
}

module.exports = { createCatalogRepository };
