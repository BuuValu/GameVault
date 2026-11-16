const jwt = require('jsonwebtoken');
const { parseRouteId } = require('../utils/validations');

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Debes iniciar sesión para acceder a este recurso.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({
            message: 'Token inválido o expirado.'
        });
    }
}

function adminOnly(req, res, next) {
    if (!req.user || req.user.role !== 'administrator') {
        return res.status(403).json({
            message: 'No tienes permisos para realizar esta operación.'
        });
    }

    next();
}

function sameUserOrAdmin(req, res, next) {
    const requestedId = parseRouteId(req.params.id, 'El ID del usuario');
    const authenticatedId = Number(req.user.user_id);

    if (
        req.user.role !== 'administrator' &&
        authenticatedId !== requestedId
    ) {
        return res.status(403).json({
            message: 'No tienes permiso para modificar este usuario.'
        });
    }

    next();
}

function authenticateOptional(req, res, next) {
    if (!req.headers.authorization) {
        return next();
    }

    return authenticate(req, res, next);
}

module.exports = {
    authenticateOptional,
    authenticate,
    adminOnly,
    sameUserOrAdmin
};
