const { httpError } = require('../utils/errors');
const { parseRouteId, requestBody, requireText } = require('../utils/validations');

function createCatalogService({ repository, labels, maxNameLength }) {
    function parseName(data) {
        return requireText(requestBody(data).name, 'El nombre', maxNameLength);
    }

    async function list() {
        return repository.list();
    }

    async function getById(id) {
        const record = await repository.findById(parseRouteId(id));

        if (!record) {
            throw httpError(labels.notFound, 404);
        }

        return record;
    }

    async function create(data) {
        const name = parseName(data);

        if (await repository.findByName(name)) {
            throw httpError(labels.duplicate, 409);
        }

        return repository.create(name);
    }

    async function update(id, data) {
        const validId = parseRouteId(id);
        const name = parseName(data);

        if (!(await repository.findById(validId))) {
            throw httpError(labels.notFound, 404);
        }

        const sameName = await repository.findByName(name);

        if (sameName && sameName[labels.primaryKey] !== validId) {
            throw httpError(labels.duplicate, 409);
        }

        return repository.update(validId, name);
    }

    async function remove(id) {
        const record = await getById(id);

        if (record[labels.usageField] > 0) {
            throw httpError(labels.inUse, 409);
        }

        await repository.remove(record[labels.primaryKey]);

        return { message: labels.deleted };
    }

    async function requireExistingIds(ids, field) {
        const existing = await repository.findExistingIds(ids);
        const missing = ids.filter((id) => !existing.includes(id));

        if (missing.length > 0) {
            throw httpError(
                `${field} contiene IDs inexistentes: ${missing.join(', ')}.`
            );
        }
    }

    return { list, getById, create, update, remove, requireExistingIds };
}

module.exports = { createCatalogService };
