const { httpError } = require('./errors');

const MAX_PRICE = 99999999.99;

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requestBody(body) {
    if (body === undefined || body === null) {
        return {};
    }

    if (!isObject(body)) {
        throw httpError('El cuerpo de la solicitud debe ser un objeto JSON.');
    }

    return body;
}

function parseRouteId(value, name = 'ID') {
    const text = String(value);
    const number = Number(text);

    if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number <= 0) {
        throw httpError(`${name} debe ser un número entero positivo.`);
    }

    return number;
}

function requireInteger(value, field, { min = 1, max = 2147483647 } = {}) {
    if (!Number.isInteger(value) || value < min || value > max) {
        throw httpError(`${field} debe ser un entero entre ${min} y ${max}.`);
    }

    return value;
}

function requireText(value, field, max) {
    if (typeof value !== 'string' || !value.trim()) {
        throw httpError(`${field} es obligatorio.`);
    }

    const trimmed = value.trim();

    if (trimmed.length > max) {
        throw httpError(`${field} no puede superar ${max} caracteres.`);
    }

    return trimmed;
}

function optionalText(value, field, max) {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== 'string') {
        throw httpError(`${field} debe ser texto.`);
    }

    const trimmed = value.trim();

    if (trimmed.length > max) {
        throw httpError(`${field} no puede superar ${max} caracteres.`);
    }

    return trimmed === '' ? null : trimmed;
}

function nonNegativeDecimal(value, field, max = MAX_PRICE) {
    const isValid =
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= max &&
        Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

    if (!isValid) {
        throw httpError(
            `${field} debe ser un número entre 0 y ${max} con máximo 2 decimales.`
        );
    }

    return value;
}

function requireBoolean(value, field) {
    if (typeof value !== 'boolean') {
        throw httpError(`${field} debe ser true o false.`);
    }

    return value;
}

function optionalUrl(value, field, max = 500) {
    const text = optionalText(value, field, max);

    if (text === null) {
        return null;
    }

    try {
        const url = new URL(text);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('protocolo');
        }
    } catch {
        throw httpError(`${field} debe ser una URL http o https válida.`);
    }

    return text;
}

function parseIdList(value, field, maxItems = 20) {
    if (!Array.isArray(value)) {
        throw httpError(`${field} debe ser un arreglo de IDs.`);
    }

    if (value.length > maxItems) {
        throw httpError(`${field} admite máximo ${maxItems} elementos.`);
    }

    const ids = value.map((id) => requireInteger(id, `Cada elemento de ${field}`));

    return [...new Set(ids)];
}

function parsePagination(query) {
    const page = query.page === undefined
        ? 1
        : Number(query.page);
    const limit = query.limit === undefined
        ? 20
        : Number(query.limit);

    if (!Number.isSafeInteger(page) || page < 1) {
        throw httpError('pagina debe ser un entero positivo válido.');
    }

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw httpError('limite debe ser un entero entre 1 y 100.');
    }

    const offset = (page - 1) * limit;

    if (!Number.isSafeInteger(offset)) {
        throw httpError('pagina está fuera del rango permitido.');
    }

    return { page, limit, offset };
}

function paginatedResponse(data, total, { page, limit }) {
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit))
        }
    };
}

module.exports = {
    requestBody,
    parseRouteId,
    requireInteger,
    requireText,
    optionalText,
    nonNegativeDecimal,
    requireBoolean,
    optionalUrl,
    parseIdList,
    parsePagination,
    paginatedResponse
};
