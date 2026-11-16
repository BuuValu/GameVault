const MYSQL_ERROR_RESPONSES = {
    ER_DUP_ENTRY: [409, 'Ya existe un registro con esos datos.'],
    ER_NO_REFERENCED_ROW_2: [400, 'La operación hace referencia a un registro inexistente.'],
    ER_ROW_IS_REFERENCED_2: [409, 'No se puede eliminar o modificar el registro porque otros registros dependen de él.'],
    ER_CHECK_CONSTRAINT_VIOLATED: [400, 'Los datos no cumplen las restricciones de la base de datos.'],
    ER_BAD_NULL_ERROR: [400, 'Falta un dato obligatorio.'],
    ER_DATA_TOO_LONG: [400, 'Un dato supera la longitud permitida.'],
    ER_TRUNCATED_WRONG_VALUE: [400, 'Un dato tiene un formato inválido.'],
    ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: [400, 'Un dato tiene un formato inválido.'],
    ER_WARN_DATA_OUT_OF_RANGE: [400, 'Un dato está fuera del rango permitido.'],
    ER_LOCK_DEADLOCK: [503, 'Conflicto temporal con otra operación. Intenta de nuevo.'],
    ER_LOCK_WAIT_TIMEOUT: [503, 'La operación tardó demasiado. Intenta de nuevo.'],
    ER_CON_COUNT_ERROR: [503, 'La base de datos no está disponible en este momento.'],
    PROTOCOL_CONNECTION_LOST: [503, 'La base de datos no está disponible en este momento.'],
    ECONNREFUSED: [503, 'La base de datos no está disponible en este momento.'],
    ETIMEDOUT: [503, 'La base de datos no está disponible en este momento.']
};

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'El cuerpo de la solicitud no es un JSON válido.'
        });
    }

    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            error: 'El cuerpo de la solicitud es demasiado grande.'
        });
    }

    const mysqlError = MYSQL_ERROR_RESPONSES[error.code];

    if (mysqlError) {
        const [status, message] = mysqlError;

        if (status >= 500) {
            console.error(error);
        }

        return res.status(status).json({ error: message });
    }

    if (error.status && error.status < 500) {
        const errorBody = { error: error.message };

        if (error.details) {
            errorBody.details = error.details;
        }

        return res.status(error.status).json(errorBody);
    }

    console.error(error);

    return res.status(500).json({
        error: 'Error interno del servidor.'
    });
}

module.exports = errorHandler;
