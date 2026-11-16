function createCatalogController(service, messages) {
    return {
        async list(req, res) {
            res.status(200).json(await service.list());
        },

        async getById(req, res) {
            res.status(200).json(await service.getById(req.params.id));
        },

        async create(req, res) {
            const record = await service.create(req.body);
            res.status(201).json({ message: messages.created, ...record });
        },

        async update(req, res) {
            const record = await service.update(req.params.id, req.body);
            res.status(200).json({ message: messages.updated, ...record });
        },

        async remove(req, res) {
            res.status(200).json(await service.remove(req.params.id));
        }
    };
}

module.exports = { createCatalogController };
