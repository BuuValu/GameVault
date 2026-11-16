function notFoundHandler(req, res) {
    res.status(404).json({
        error: `La ruta ${req.method} ${req.originalUrl} no existe.`
    });
}

module.exports = notFoundHandler;
