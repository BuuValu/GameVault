jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/progress.repository');
jest.mock('../repositories/achievements.repository');
jest.mock('../repositories/purchases.repository');
jest.mock('../repositories/users.repository');

const request = require('supertest');
const app = require('../app');
const progressRepo = require('../repositories/progress.repository');
const achievementsRepo = require('../repositories/achievements.repository');
const purchasesRepo = require('../repositories/purchases.repository');
const usersRepo = require('../repositories/users.repository');
const { tokens, purchase, achievement, simpleAchievement, mysqlError } = require('./helpers');

const UNLOCK_DATE = '2026-10-05T12:00:00.000Z';

const inProgress = {
    user_id: 2,
    achievement_id: 7,
    progress: 4,
    is_unlocked: false,
    unlock_date: null,
    video_game_id: 1,
    achievement_name: 'Coleccionista',
    type: 'progress',
    target: 10
};

const completed = { ...inProgress, progress: 10, is_unlocked: true, unlock_date: UNLOCK_DATE };

beforeEach(() => {
    jest.resetAllMocks();
    usersRepo.findById.mockResolvedValue({ user_id: 2 });
});

describe('PUT /api/users/:id/achievements/:achievementId', () => {
    function prepareProgressUpdate(currentAchievement = achievement, currentProgress = null) {
        achievementsRepo.findById.mockResolvedValue(currentAchievement);
        purchasesRepo.findByUserAndVideoGame.mockResolvedValue(purchase);
        progressRepo.findByUserAndAchievement.mockResolvedValue(currentProgress);
        progressRepo.save.mockImplementation(async (data) => ({
            ...inProgress,
            progress: data.progress,
            is_unlocked: data.unlocked,
            unlock_date: data.unlockDate
        }));
    }

    test('éxito 201: primer avance parcial (sin desbloquear)', async () => {
        prepareProgressUpdate();

        const res = await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana)
            .send({ progress: 4 });

        expect(res.status).toBe(201);
        expect(progressRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ progress: 4, unlocked: false, unlockDate: null })
        );
    });

    test('éxito 200: al alcanzar la meta se desbloquea y se fija la fecha', async () => {
        prepareProgressUpdate(achievement, inProgress);

        const res = await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana)
            .send({ progress: 10 });

        expect(res.status).toBe(200);
        const saved = progressRepo.save.mock.calls[0][0];
        expect(saved.unlocked).toBe(true);
        expect(saved.unlockDate).toBeInstanceOf(Date);
    });

    test('éxito: repetir el PUT conserva la fecha de desbloqueo original', async () => {
        prepareProgressUpdate(achievement, completed);

        await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana)
            .send({ progress: 10 });

        expect(progressRepo.save.mock.calls[0][0].unlockDate).toBe(UNLOCK_DATE);
    });

    test('éxito: un logro simple se desbloquea con progreso = 1', async () => {
        prepareProgressUpdate(simpleAchievement);

        const res = await request(app)
            .put('/api/users/2/achievements/8')
            .set('Authorization', tokens.ana)
            .send({ progress: 1 });

        expect(res.status).toBe(201);
        expect(progressRepo.save.mock.calls[0][0].unlocked).toBe(true);
    });

    test('éxito: un administrador registra progreso de otro usuario', async () => {
        prepareProgressUpdate();

        const res = await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.admin)
            .send({ progress: 2 });

        expect(res.status).toBe(201);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).put('/api/users/2/achievements/7').send({ progress: 1 });
        expect(res.status).toBe(401);
    });

    test('error 403: avanzar en el logro de otro usuario', async () => {
        const res = await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.beto)
            .send({ progress: 1 });

        expect(res.status).toBe(403);
    });

    test.each([
        ['negativo', { progress: -1 }],
        ['decimal', { progress: 2.5 }],
        ['texto', { progress: '3' }],
        ['ausente', {}]
    ])('error 400: progreso %s', async (_case, requestBody) => {
        prepareProgressUpdate();

        const res = await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana)
            .send(requestBody);

        expect(res.status).toBe(400);
        expect(progressRepo.save).not.toHaveBeenCalled();
    });

    test('error 400: el progreso supera la meta', async () => {
        prepareProgressUpdate();

        const res = await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana)
            .send({ progress: 11 });

        expect(res.status).toBe(400);
    });

    test('error 400: un logro simple no admite progreso mayor que 1', async () => {
        prepareProgressUpdate(simpleAchievement);

        const res = await request(app)
            .put('/api/users/2/achievements/8')
            .set('Authorization', tokens.ana)
            .send({ progress: 3 });

        expect(res.status).toBe(400);
    });

    test('error 403: no tiene el videojuego comprado', async () => {
        prepareProgressUpdate();
        purchasesRepo.findByUserAndVideoGame.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana)
            .send({ progress: 1 });

        expect(res.status).toBe(403);
    });

    test('error 403: la compra aún está pendiente', async () => {
        prepareProgressUpdate();
        purchasesRepo.findByUserAndVideoGame.mockResolvedValue({ ...purchase, status: 'pending' });

        const res = await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana)
            .send({ progress: 1 });

        expect(res.status).toBe(403);
    });

    test('error 409: el progreso no puede retroceder', async () => {
        prepareProgressUpdate(achievement, inProgress);

        const res = await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana)
            .send({ progress: 2 });

        expect(res.status).toBe(409);
        expect(progressRepo.save).not.toHaveBeenCalled();
    });

    test('error 404: el logro no existe', async () => {
        achievementsRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/users/2/achievements/99')
            .set('Authorization', tokens.ana)
            .send({ progress: 1 });

        expect(res.status).toBe(404);
    });

    test('error 404: el usuario no existe (administrador)', async () => {
        usersRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/users/99/achievements/7')
            .set('Authorization', tokens.admin)
            .send({ progress: 1 });

        expect(res.status).toBe(404);
    });

    test('error MySQL ER_NO_REFERENCED_ROW_2 → 400', async () => {
        prepareProgressUpdate();
        progressRepo.save.mockRejectedValue(mysqlError('ER_NO_REFERENCED_ROW_2'));

        const res = await request(app)
            .put('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana)
            .send({ progress: 1 });

        expect(res.status).toBe(400);
    });
});

describe('GET /api/users/:id/achievements', () => {
    test('éxito: lista el progreso del usuario', async () => {
        progressRepo.listByUser.mockResolvedValue([inProgress, completed]);

        const res = await request(app)
            .get('/api/users/2/achievements')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(progressRepo.listByUser).toHaveBeenCalledWith(2, undefined);
    });

    test('éxito: filtra por videojuego', async () => {
        progressRepo.listByUser.mockResolvedValue([inProgress]);

        const res = await request(app)
            .get('/api/users/2/achievements?video_game_id=1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
        expect(progressRepo.listByUser).toHaveBeenCalledWith(2, 1);
    });

    test('error 403: otro usuario', async () => {
        const res = await request(app)
            .get('/api/users/2/achievements')
            .set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).get('/api/users/2/achievements');
        expect(res.status).toBe(401);
    });

    test('error 400: video_game_id inválido', async () => {
        const res = await request(app)
            .get('/api/users/2/achievements?video_game_id=abc')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(400);
    });
});

describe('GET /api/users/:id/achievements/:achievementId', () => {
    test('éxito', async () => {
        achievementsRepo.findById.mockResolvedValue(achievement);
        progressRepo.findByUserAndAchievement.mockResolvedValue(inProgress);

        const res = await request(app)
            .get('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(res.body.progress).toBe(4);
    });

    test('error 404: todavía no hay progreso registrado', async () => {
        achievementsRepo.findById.mockResolvedValue(achievement);
        progressRepo.findByUserAndAchievement.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(404);
    });

    test('error 404: el logro no existe', async () => {
        achievementsRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/users/2/achievements/99')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/users/:id/achievements/:achievementId', () => {
    test('éxito: reinicia el progreso', async () => {
        progressRepo.remove.mockResolvedValue(true);

        const res = await request(app)
            .delete('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(progressRepo.remove).toHaveBeenCalledWith(2, 7);
    });

    test('error 404: no había progreso', async () => {
        progressRepo.remove.mockResolvedValue(false);

        const res = await request(app)
            .delete('/api/users/2/achievements/7')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(404);
    });

    test('error 403: otro usuario', async () => {
        const res = await request(app)
            .delete('/api/users/2/achievements/7')
            .set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
    });
});
