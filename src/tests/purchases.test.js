jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/purchases.repository');
jest.mock('../repositories/video-games.repository');
jest.mock('../repositories/users.repository');

const request = require('supertest');
const app = require('../app');
const purchasesRepo = require('../repositories/purchases.repository');
const videoGamesRepo = require('../repositories/video-games.repository');
const usersRepo = require('../repositories/users.repository');
const { tokens, videoGame, purchase, mysqlError } = require('./helpers');

const pendingPurchase = { ...purchase, status: 'pending' };

beforeEach(() => {
    jest.resetAllMocks();
});

describe('POST /api/purchases', () => {
    test('éxito 201: usa el usuario del token y el precio del catálogo', async () => {
        videoGamesRepo.findById.mockResolvedValue(videoGame);
        purchasesRepo.findByUserAndVideoGame.mockResolvedValue(null);
        purchasesRepo.create.mockResolvedValue(pendingPurchase);

        const res = await request(app)
            .post('/api/purchases')
            .set('Authorization', tokens.ana)
            .send({ video_game_id: 1, price_paid: 0, user_id: 3 });

        expect(res.status).toBe(201);
        expect(res.headers.location).toBe('/api/purchases/10');
        expect(purchasesRepo.create).toHaveBeenCalledWith({
            userId: 2,
            videoGameId: 1,
            price: 59.99
        });
    });

    test('éxito: reintento de una compra fallida reutiliza la fila', async () => {
        videoGamesRepo.findById.mockResolvedValue(videoGame);
        purchasesRepo.findByUserAndVideoGame.mockResolvedValue({ ...purchase, status: 'failed' });
        purchasesRepo.retryFailed.mockResolvedValue(pendingPurchase);

        const res = await request(app)
            .post('/api/purchases')
            .set('Authorization', tokens.ana)
            .send({ video_game_id: 1 });

        expect(res.status).toBe(201);
        expect(purchasesRepo.retryFailed).toHaveBeenCalledWith(10, 59.99);
        expect(purchasesRepo.create).not.toHaveBeenCalled();
    });

    test('error 401: sin token', async () => {
        const res = await request(app).post('/api/purchases').send({ video_game_id: 1 });
        expect(res.status).toBe(401);
    });

    test.each([
        ['falta video_game_id', {}],
        ['video_game_id como texto', { video_game_id: '1' }],
        ['video_game_id negativo', { video_game_id: -4 }]
    ])('error 400: %s', async (_case, requestBody) => {
        const res = await request(app)
            .post('/api/purchases')
            .set('Authorization', tokens.ana)
            .send(requestBody);

        expect(res.status).toBe(400);
    });

    test('error 400: el videojuego no existe', async () => {
        videoGamesRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/purchases')
            .set('Authorization', tokens.ana)
            .send({ video_game_id: 99 });

        expect(res.status).toBe(400);
    });

    test('error 409: el videojuego está desactivado', async () => {
        videoGamesRepo.findById.mockResolvedValue({ ...videoGame, is_active: false });

        const res = await request(app)
            .post('/api/purchases')
            .set('Authorization', tokens.ana)
            .send({ video_game_id: 1 });

        expect(res.status).toBe(409);
    });

    test('error 409: ya compró ese videojuego', async () => {
        videoGamesRepo.findById.mockResolvedValue(videoGame);
        purchasesRepo.findByUserAndVideoGame.mockResolvedValue(purchase);

        const res = await request(app)
            .post('/api/purchases')
            .set('Authorization', tokens.ana)
            .send({ video_game_id: 1 });

        expect(res.status).toBe(409);
        expect(purchasesRepo.create).not.toHaveBeenCalled();
    });

    test('error MySQL ER_DUP_ENTRY (doble clic simultáneo) → 409', async () => {
        videoGamesRepo.findById.mockResolvedValue(videoGame);
        purchasesRepo.findByUserAndVideoGame.mockResolvedValue(null);
        purchasesRepo.create.mockRejectedValue(mysqlError('ER_DUP_ENTRY'));

        const res = await request(app)
            .post('/api/purchases')
            .set('Authorization', tokens.ana)
            .send({ video_game_id: 1 });

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_NO_REFERENCED_ROW_2 (usuario del token ya no existe) → 400', async () => {
        videoGamesRepo.findById.mockResolvedValue(videoGame);
        purchasesRepo.findByUserAndVideoGame.mockResolvedValue(null);
        purchasesRepo.create.mockRejectedValue(mysqlError('ER_NO_REFERENCED_ROW_2'));

        const res = await request(app)
            .post('/api/purchases')
            .set('Authorization', tokens.ana)
            .send({ video_game_id: 1 });

        expect(res.status).toBe(400);
    });
});

describe('GET /api/purchases (administrador)', () => {
    test('éxito: lista paginada con filtros', async () => {
        purchasesRepo.list.mockResolvedValue({ total: 1, purchases: [purchase] });

        const res = await request(app)
            .get('/api/purchases?status=confirmed&user_id=2')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(purchasesRepo.list.mock.calls[0][0]).toMatchObject({
            status: 'confirmed',
            userId: 2
        });
    });

    test('error 403: un usuario normal no lista todas las compras', async () => {
        const res = await request(app).get('/api/purchases').set('Authorization', tokens.ana);
        expect(res.status).toBe(403);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).get('/api/purchases');
        expect(res.status).toBe(401);
    });

    test('error 400: estado desconocido', async () => {
        const res = await request(app)
            .get('/api/purchases?status=regalada')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(400);
    });
});

describe('GET /api/users/:id/purchases', () => {
    test('éxito: el usuario consulta sus propias compras', async () => {
        usersRepo.findById.mockResolvedValue({ user_id: 2 });
        purchasesRepo.list.mockResolvedValue({ total: 1, purchases: [purchase] });

        const res = await request(app)
            .get('/api/users/2/purchases')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(purchasesRepo.list.mock.calls[0][0].userId).toBe(2);
    });

    test('éxito: un administrador consulta las de otro usuario', async () => {
        usersRepo.findById.mockResolvedValue({ user_id: 2 });
        purchasesRepo.list.mockResolvedValue({ total: 0, purchases: [] });

        const res = await request(app)
            .get('/api/users/2/purchases')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('error 403: consultar las compras de otro usuario', async () => {
        const res = await request(app)
            .get('/api/users/2/purchases')
            .set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
    });

    test('error 404: el usuario no existe', async () => {
        usersRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/users/99/purchases')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).get('/api/users/2/purchases');
        expect(res.status).toBe(401);
    });
});

describe('GET /api/purchases/:id', () => {
    test('éxito: el dueño ve su compra', async () => {
        purchasesRepo.findById.mockResolvedValue(purchase);

        const res = await request(app).get('/api/purchases/10').set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(res.body.purchase_id).toBe(10);
    });

    test('éxito: un administrador ve cualquier compra', async () => {
        purchasesRepo.findById.mockResolvedValue(purchase);

        const res = await request(app).get('/api/purchases/10').set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('error 403: otro usuario', async () => {
        purchasesRepo.findById.mockResolvedValue(purchase);

        const res = await request(app).get('/api/purchases/10').set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
    });

    test('error 404: no existe', async () => {
        purchasesRepo.findById.mockResolvedValue(null);

        const res = await request(app).get('/api/purchases/99').set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });

    test('error 400: ID inválido', async () => {
        const res = await request(app).get('/api/purchases/xyz').set('Authorization', tokens.admin);
        expect(res.status).toBe(400);
    });
});

describe('PATCH /api/purchases/:id/estado (administrador)', () => {
    test('éxito: confirma una compra pendiente', async () => {
        purchasesRepo.findById.mockResolvedValue(pendingPurchase);
        purchasesRepo.changeStatus.mockResolvedValue({ ...pendingPurchase, status: 'confirmed' });

        const res = await request(app)
            .patch('/api/purchases/10/status')
            .set('Authorization', tokens.admin)
            .send({ status: 'confirmed' });

        expect(res.status).toBe(200);
        expect(res.body.purchase.status).toBe('confirmed');
        expect(purchasesRepo.changeStatus).toHaveBeenCalledWith(10, 'pending', 'confirmed');
    });

    test('éxito: marca una compra pendiente como fallida', async () => {
        purchasesRepo.findById.mockResolvedValue(pendingPurchase);
        purchasesRepo.changeStatus.mockResolvedValue({ ...pendingPurchase, status: 'failed' });

        const res = await request(app)
            .patch('/api/purchases/10/status')
            .set('Authorization', tokens.admin)
            .send({ status: 'failed' });

        expect(res.status).toBe(200);
    });

    test('error 403: un usuario no confirma sus propios pagos', async () => {
        const res = await request(app)
            .patch('/api/purchases/10/status')
            .set('Authorization', tokens.ana)
            .send({ status: 'confirmed' });

        expect(res.status).toBe(403);
    });

    test.each([
        ['estado inexistente', { status: 'regalada' }],
        ['volver a pendiente', { status: 'pending' }],
        ['sin estado', {}]
    ])('error 400: %s', async (_case, requestBody) => {
        const res = await request(app)
            .patch('/api/purchases/10/status')
            .set('Authorization', tokens.admin)
            .send(requestBody);

        expect(res.status).toBe(400);
    });

    test('error 404: la compra no existe', async () => {
        purchasesRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .patch('/api/purchases/99/status')
            .set('Authorization', tokens.admin)
            .send({ status: 'confirmed' });

        expect(res.status).toBe(404);
    });

    test('error 409: la compra ya no está pendiente', async () => {
        purchasesRepo.findById.mockResolvedValue(purchase);

        const res = await request(app)
            .patch('/api/purchases/10/status')
            .set('Authorization', tokens.admin)
            .send({ status: 'failed' });

        expect(res.status).toBe(409);
    });

    test('error 409: otra solicitud cambió el estado primero (concurrencia)', async () => {
        purchasesRepo.findById.mockResolvedValue(pendingPurchase);
        purchasesRepo.changeStatus.mockResolvedValue(null);

        const res = await request(app)
            .patch('/api/purchases/10/status')
            .set('Authorization', tokens.admin)
            .send({ status: 'confirmed' });

        expect(res.status).toBe(409);
    });
});

describe('DELETE /api/purchases/:id (cancelar)', () => {
    test('éxito: el dueño cancela una compra pendiente', async () => {
        purchasesRepo.findById.mockResolvedValue(pendingPurchase);
        purchasesRepo.removePending.mockResolvedValue(true);

        const res = await request(app).delete('/api/purchases/10').set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(purchasesRepo.removePending).toHaveBeenCalledWith(10);
    });

    test('error 409: no se cancela una compra confirmada', async () => {
        purchasesRepo.findById.mockResolvedValue(purchase);

        const res = await request(app).delete('/api/purchases/10').set('Authorization', tokens.ana);

        expect(res.status).toBe(409);
        expect(purchasesRepo.removePending).not.toHaveBeenCalled();
    });

    test('error 403: otro usuario', async () => {
        purchasesRepo.findById.mockResolvedValue(pendingPurchase);

        const res = await request(app).delete('/api/purchases/10').set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
    });

    test('error 404: no existe', async () => {
        purchasesRepo.findById.mockResolvedValue(null);

        const res = await request(app).delete('/api/purchases/99').set('Authorization', tokens.ana);

        expect(res.status).toBe(404);
    });

    test('error 409: se confirmó mientras se cancelaba (concurrencia)', async () => {
        purchasesRepo.findById.mockResolvedValue(pendingPurchase);
        purchasesRepo.removePending.mockResolvedValue(false);

        const res = await request(app).delete('/api/purchases/10').set('Authorization', tokens.ana);

        expect(res.status).toBe(409);
    });
});
