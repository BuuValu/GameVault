jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/achievements.repository');
jest.mock('../repositories/progress.repository');
jest.mock('../repositories/video-games.repository');

const request = require('supertest');
const app = require('../app');
const achievementsRepo = require('../repositories/achievements.repository');
const progressRepo = require('../repositories/progress.repository');
const videoGamesRepo = require('../repositories/video-games.repository');
const { tokens, videoGame, achievement, simpleAchievement, mysqlError } = require('./helpers');

beforeEach(() => {
    jest.resetAllMocks();
});

describe('GET /api/video-games/:id/achievements', () => {
    test('éxito: lista pública de logros del videojuego', async () => {
        videoGamesRepo.findById.mockResolvedValue(videoGame);
        achievementsRepo.listByVideoGame.mockResolvedValue([achievement, simpleAchievement]);

        const res = await request(app).get('/api/video-games/1/achievements');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    test('error 404: el videojuego no existe', async () => {
        videoGamesRepo.findById.mockResolvedValue(null);

        const res = await request(app).get('/api/video-games/99/achievements');

        expect(res.status).toBe(404);
    });

    test('error 400: ID inválido', async () => {
        const res = await request(app).get('/api/video-games/abc/achievements');
        expect(res.status).toBe(400);
    });
});

describe('POST /api/video-games/:id/achievements', () => {
    function prepareCreation() {
        videoGamesRepo.findById.mockResolvedValue(videoGame);
        achievementsRepo.findByName.mockResolvedValue(null);
    }

    test('éxito 201: logro de tipo progreso con meta', async () => {
        prepareCreation();
        achievementsRepo.create.mockResolvedValue(achievement);

        const res = await request(app)
            .post('/api/video-games/1/achievements')
            .set('Authorization', tokens.admin)
            .send({ name: 'Coleccionista', description: 'Reúne 10 objetos', type: 'progress', target: 10 });

        expect(res.status).toBe(201);
        expect(res.headers.location).toBe('/api/achievements/7');
        expect(achievementsRepo.create).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ type: 'progress', target: 10 })
        );
    });

    test('éxito 201: sin tipo se asume "simple" y meta nula', async () => {
        prepareCreation();
        achievementsRepo.create.mockResolvedValue(simpleAchievement);

        const res = await request(app)
            .post('/api/video-games/1/achievements')
            .set('Authorization', tokens.admin)
            .send({ name: 'Primer paso', description: 'Empieza el juego' });

        expect(res.status).toBe(201);
        expect(achievementsRepo.create.mock.calls[0][1]).toMatchObject({ type: 'simple', target: null });
    });

    test('error 401: sin token', async () => {
        const res = await request(app)
            .post('/api/video-games/1/achievements')
            .send({ name: 'X', description: 'Y' });
        expect(res.status).toBe(401);
    });

    test('error 403: usuario normal', async () => {
        const res = await request(app)
            .post('/api/video-games/1/achievements')
            .set('Authorization', tokens.ana)
            .send({ name: 'X', description: 'Y' });
        expect(res.status).toBe(403);
    });

    test.each([
        ['sin nombre', { description: 'Y' }],
        ['sin descripción', { name: 'X' }],
        ['tipo desconocido', { name: 'X', description: 'Y', type: 'secreto' }],
        ['progreso sin meta', { name: 'X', description: 'Y', type: 'progress' }],
        ['meta cero', { name: 'X', description: 'Y', type: 'progress', target: 0 }],
        ['meta decimal', { name: 'X', description: 'Y', type: 'progress', target: 2.5 }],
        ['simple con meta', { name: 'X', description: 'Y', type: 'simple', target: 5 }],
        ['fecha con meta', { name: 'X', description: 'Y', type: 'date', target: 5 }]
    ])('error 400: %s', async (_case, requestBody) => {
        prepareCreation();

        const res = await request(app)
            .post('/api/video-games/1/achievements')
            .set('Authorization', tokens.admin)
            .send(requestBody);

        expect(res.status).toBe(400);
        expect(achievementsRepo.create).not.toHaveBeenCalled();
    });

    test('error 404: el videojuego no existe', async () => {
        videoGamesRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/video-games/99/achievements')
            .set('Authorization', tokens.admin)
            .send({ name: 'X', description: 'Y' });

        expect(res.status).toBe(404);
    });

    test('error 409: nombre repetido en el mismo videojuego', async () => {
        prepareCreation();
        achievementsRepo.findByName.mockResolvedValue({ achievement_id: 7 });

        const res = await request(app)
            .post('/api/video-games/1/achievements')
            .set('Authorization', tokens.admin)
            .send({ name: 'Coleccionista', description: 'Y' });

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_DUP_ENTRY (carrera) → 409', async () => {
        prepareCreation();
        achievementsRepo.create.mockRejectedValue(mysqlError('ER_DUP_ENTRY'));

        const res = await request(app)
            .post('/api/video-games/1/achievements')
            .set('Authorization', tokens.admin)
            .send({ name: 'Coleccionista', description: 'Y' });

        expect(res.status).toBe(409);
    });
});

describe('GET /api/achievements/:id', () => {
    test('éxito', async () => {
        achievementsRepo.findById.mockResolvedValue(achievement);

        const res = await request(app).get('/api/achievements/7');

        expect(res.status).toBe(200);
        expect(res.body.target).toBe(10);
    });

    test('error 404', async () => {
        achievementsRepo.findById.mockResolvedValue(null);
        const res = await request(app).get('/api/achievements/99');
        expect(res.status).toBe(404);
    });

    test('error 400: ID inválido', async () => {
        const res = await request(app).get('/api/achievements/siete');
        expect(res.status).toBe(400);
    });
});

describe('PUT /api/achievements/:id', () => {
    const progressBody = {
        name: 'Coleccionista',
        description: 'Nueva descripción',
        type: 'progress',
        target: 10
    };

    test('éxito: cambia la descripción aunque haya progreso registrado', async () => {
        achievementsRepo.findById.mockResolvedValue(achievement);
        achievementsRepo.findByName.mockResolvedValue({ achievement_id: 7 });
        achievementsRepo.update.mockResolvedValue({ ...achievement, description: 'Nueva descripción' });

        const res = await request(app)
            .put('/api/achievements/7')
            .set('Authorization', tokens.admin)
            .send(progressBody);

        expect(res.status).toBe(200);
        expect(progressRepo.countByAchievement).not.toHaveBeenCalled();
    });

    test('éxito: cambia la meta si nadie tiene progreso todavía', async () => {
        achievementsRepo.findById.mockResolvedValue(achievement);
        achievementsRepo.findByName.mockResolvedValue({ achievement_id: 7 });
        progressRepo.countByAchievement.mockResolvedValue(0);
        achievementsRepo.update.mockResolvedValue({ ...achievement, target: 20 });

        const res = await request(app)
            .put('/api/achievements/7')
            .set('Authorization', tokens.admin)
            .send({ ...progressBody, target: 20 });

        expect(res.status).toBe(200);
    });

    test('error 409: cambiar la meta con progreso registrado', async () => {
        achievementsRepo.findById.mockResolvedValue(achievement);
        achievementsRepo.findByName.mockResolvedValue({ achievement_id: 7 });
        progressRepo.countByAchievement.mockResolvedValue(3);

        const res = await request(app)
            .put('/api/achievements/7')
            .set('Authorization', tokens.admin)
            .send({ ...progressBody, target: 20 });

        expect(res.status).toBe(409);
        expect(achievementsRepo.update).not.toHaveBeenCalled();
    });

    test('error 409: el nombre ya lo usa otro logro del videojuego', async () => {
        achievementsRepo.findById.mockResolvedValue(achievement);
        achievementsRepo.findByName.mockResolvedValue({ achievement_id: 8 });

        const res = await request(app)
            .put('/api/achievements/7')
            .set('Authorization', tokens.admin)
            .send(progressBody);

        expect(res.status).toBe(409);
    });

    test('error 400: progreso sin meta', async () => {
        achievementsRepo.findById.mockResolvedValue(achievement);

        const res = await request(app)
            .put('/api/achievements/7')
            .set('Authorization', tokens.admin)
            .send({ name: 'X', description: 'Y', type: 'progress' });

        expect(res.status).toBe(400);
    });

    test('error 404: no existe', async () => {
        achievementsRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/achievements/99')
            .set('Authorization', tokens.admin)
            .send(progressBody);

        expect(res.status).toBe(404);
    });

    test('error 403: usuario normal', async () => {
        const res = await request(app)
            .put('/api/achievements/7')
            .set('Authorization', tokens.ana)
            .send(progressBody);

        expect(res.status).toBe(403);
    });
});

describe('DELETE /api/achievements/:id', () => {
    test('éxito', async () => {
        achievementsRepo.findById.mockResolvedValue(achievement);
        achievementsRepo.remove.mockResolvedValue(true);

        const res = await request(app).delete('/api/achievements/7').set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
        expect(achievementsRepo.remove).toHaveBeenCalledWith(7);
    });

    test('error 404: no existe', async () => {
        achievementsRepo.findById.mockResolvedValue(null);

        const res = await request(app).delete('/api/achievements/99').set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });

    test('error 403: usuario normal', async () => {
        const res = await request(app).delete('/api/achievements/7').set('Authorization', tokens.ana);
        expect(res.status).toBe(403);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).delete('/api/achievements/7');
        expect(res.status).toBe(401);
    });
});
