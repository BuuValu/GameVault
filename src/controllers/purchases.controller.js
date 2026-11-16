const purchasesService = require('../services/purchases.service');

async function list(req, res) {
    res.status(200).json(await purchasesService.list(req.query));
}

async function listByUser(req, res) {
    res.status(200).json(
        await purchasesService.listByUser(req.params.id, req.query)
    );
}

async function getById(req, res) {
    res.status(200).json(
        await purchasesService.getById(req.params.id, req.user)
    );
}

async function create(req, res) {
    const purchase = await purchasesService.create(req.user, req.body);

    res.status(201)
        .location(`/api/purchases/${purchase.purchase_id}`)
        .json({
            message: 'Compra registrada. Queda pendiente de confirmación.',
            purchase
        });
}

async function changeStatus(req, res) {
    const purchase = await purchasesService.changeStatus(req.params.id, req.body);

    res.status(200).json({
        message: `Compra marcada como ${purchase.status}.`,
        purchase
    });
}

async function cancel(req, res) {
    res.status(200).json(
        await purchasesService.cancel(req.params.id, req.user)
    );
}

module.exports = {
    list,
    listByUser,
    getById,
    create,
    changeStatus,
    cancel
};
