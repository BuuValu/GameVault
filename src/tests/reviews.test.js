jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/reviews.repository');
jest.mock('../repositories/purchases.repository');
jest.mock('../repositories/video-games.repository');
jest.mock('../repositories/tags.repository');

const request = require('supertest');
const app = require('../app');
const reviewsRepo = require('../repositories/reviews.repository');
const purchasesRepo = require('../repositories/purchases.repository');
const videoGamesRepo = require('../repositories/video-games.repository');
const tagsRepo = require('../repositories/tags.repository');
const { tokens, videoGame, purchase, review, mysqlError } = require('./helpers');

const validBody = {
    video_game_id: 1,
    rating: 4,
    comment: 'Muy bueno',
    hours_played: 12.5,
    tags: [1]
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('POST /api/reviews', () => {
    function prepareCreation() {
        videoGamesRepo.findById.mockResolvedValue(videoGame);
        tagsRepo.findExistingIds.mockResolvedValue([1]);
        purchasesRepo.findByUserAndVideoGame.mockResolvedValue(purchase);
        reviewsRepo.findByUserAndVideoGame.mockResolvedValue(null);
        reviewsRepo.create.mockResolvedValue(review);
    }

    test('éxito 201: reseña con etiquetas; el autor sale del token', async () => {
        prepareCreation();

        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', tokens.ana)
            .send({ ...validBody, user_id: 3 });

        expect(res.status).toBe(201);
        expect(res.headers.location).toBe('/api/reviews/5');
        expect(reviewsRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: 2, video_game_id: 1, rating: 4 }),
            [1]
        );
    });

    test('éxito: solo la calificación es obligatoria', async () => {
        prepareCreation();

        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', tokens.ana)
            .send({ video_game_id: 1, rating: 5 });

        expect(res.status).toBe(201);
        expect(reviewsRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({ comment: null, hours_played: null }),
            []
        );
    });

    test('error 401: sin token', async () => {
        const res = await request(app).post('/api/reviews').send(validBody);
        expect(res.status).toBe(401);
    });

    test.each([
        ['calificación 0', { rating: 0 }],
        ['calificación 6', { rating: 6 }],
        ['calificación decimal', { rating: 4.5 }],
        ['calificación como texto', { rating: '5' }],
        ['sin calificación', { rating: undefined }],
        ['horas negativas', { hours_played: -1 }],
        ['horas como texto', { hours_played: 'muchas' }],
        ['comentario demasiado largo', { comment: 'x'.repeat(2001) }],
        ['etiquetas no es arreglo', { tags: 'divertido' }],
        ['más de 10 etiquetas', { tags: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }],
        ['sin video_game_id', { video_game_id: undefined }]
    ])('error 400: %s', async (_case, change) => {
        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', tokens.ana)
            .send({ ...validBody, ...change });

        expect(res.status).toBe(400);
        expect(reviewsRepo.create).not.toHaveBeenCalled();
    });

    test('error 400: etiqueta inexistente', async () => {
        prepareCreation();
        tagsRepo.findExistingIds.mockResolvedValue([]);

        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', tokens.ana)
            .send({ ...validBody, tags: [99] });

        expect(res.status).toBe(400);
    });

    test('error 400: el videojuego no existe', async () => {
        prepareCreation();
        videoGamesRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', tokens.ana)
            .send(validBody);

        expect(res.status).toBe(400);
    });

    test('error 403: nunca compró el videojuego', async () => {
        prepareCreation();
        purchasesRepo.findByUserAndVideoGame.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', tokens.ana)
            .send(validBody);

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('comprar');
    });

    test.each(['pending', 'failed'])(
        'error 403: la compra está %s (debe estar confirmada)',
        async (status) => {
            prepareCreation();
            purchasesRepo.findByUserAndVideoGame.mockResolvedValue({ ...purchase, status });

            const res = await request(app)
                .post('/api/reviews')
                .set('Authorization', tokens.ana)
                .send(validBody);

            expect(res.status).toBe(403);
        }
    );

    test('error 409: ya reseñó ese videojuego', async () => {
        prepareCreation();
        reviewsRepo.findByUserAndVideoGame.mockResolvedValue({ review_id: 5 });

        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', tokens.ana)
            .send(validBody);

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_DUP_ENTRY (dos reseñas simultáneas) → 409', async () => {
        prepareCreation();
        reviewsRepo.create.mockRejectedValue(mysqlError('ER_DUP_ENTRY'));

        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', tokens.ana)
            .send(validBody);

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_CHECK_CONSTRAINT_VIOLATED → 400', async () => {
        prepareCreation();
        reviewsRepo.create.mockRejectedValue(mysqlError('ER_CHECK_CONSTRAINT_VIOLATED'));

        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', tokens.ana)
            .send(validBody);

        expect(res.status).toBe(400);
    });
});

describe('GET /api/reviews', () => {
    test('éxito: lista pública paginada con filtros', async () => {
        reviewsRepo.list.mockResolvedValue({ total: 1, reviews: [review] });

        const res = await request(app).get(
            '/api/reviews?video_game_id=1&rating=4&user_id=2&page=1&limit=10'
        );

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).not.toHaveProperty('email');
        expect(reviewsRepo.list.mock.calls[0][0]).toMatchObject({
            videoGameId: 1,
            rating: 4,
            userId: 2,
            limit: 10
        });
    });

    test('error 400: calificación fuera de rango', async () => {
        const res = await request(app).get('/api/reviews?rating=9');
        expect(res.status).toBe(400);
    });

    test('error 400: video_game_id inválido', async () => {
        const res = await request(app).get('/api/reviews?video_game_id=abc');
        expect(res.status).toBe(400);
    });
});

describe('GET /api/video-games/:id/reviews', () => {
    test('éxito', async () => {
        videoGamesRepo.findById.mockResolvedValue(videoGame);
        reviewsRepo.list.mockResolvedValue({ total: 1, reviews: [review] });

        const res = await request(app).get('/api/video-games/1/reviews');

        expect(res.status).toBe(200);
        expect(reviewsRepo.list.mock.calls[0][0].videoGameId).toBe(1);
    });

    test('error 404: el videojuego no existe', async () => {
        videoGamesRepo.findById.mockResolvedValue(null);

        const res = await request(app).get('/api/video-games/99/reviews');

        expect(res.status).toBe(404);
    });
});

describe('GET /api/reviews/:id', () => {
    test('éxito', async () => {
        reviewsRepo.findById.mockResolvedValue(review);

        const res = await request(app).get('/api/reviews/5');

        expect(res.status).toBe(200);
        expect(res.body.tags).toHaveLength(1);
    });

    test('error 404', async () => {
        reviewsRepo.findById.mockResolvedValue(null);
        const res = await request(app).get('/api/reviews/99');
        expect(res.status).toBe(404);
    });

    test('error 400: ID inválido', async () => {
        const res = await request(app).get('/api/reviews/cinco');
        expect(res.status).toBe(400);
    });
});

describe('PUT /api/reviews/:id', () => {
    test('éxito: el autor edita su reseña y reemplaza etiquetas', async () => {
        reviewsRepo.findById.mockResolvedValue(review);
        tagsRepo.findExistingIds.mockResolvedValue([2]);
        reviewsRepo.update.mockResolvedValue({ ...review, rating: 5 });

        const res = await request(app)
            .put('/api/reviews/5')
            .set('Authorization', tokens.ana)
            .send({ rating: 5, comment: 'Obra maestra', tags: [2] });

        expect(res.status).toBe(200);
        expect(reviewsRepo.update).toHaveBeenCalledWith(
            5,
            { rating: 5, comment: 'Obra maestra', hours_played: null },
            [2]
        );
    });

    test('éxito: sin `etiquetas` en el cuerpo se conservan las actuales', async () => {
        reviewsRepo.findById.mockResolvedValue(review);
        reviewsRepo.update.mockResolvedValue(review);

        await request(app)
            .put('/api/reviews/5')
            .set('Authorization', tokens.ana)
            .send({ rating: 3 });

        expect(reviewsRepo.update.mock.calls[0][2]).toBeUndefined();
    });

    test('error 403: otro usuario no puede editarla', async () => {
        reviewsRepo.findById.mockResolvedValue(review);

        const res = await request(app)
            .put('/api/reviews/5')
            .set('Authorization', tokens.beto)
            .send({ rating: 1 });

        expect(res.status).toBe(403);
    });

    test('error 403: ni siquiera un administrador reescribe opiniones ajenas', async () => {
        reviewsRepo.findById.mockResolvedValue(review);

        const res = await request(app)
            .put('/api/reviews/5')
            .set('Authorization', tokens.admin)
            .send({ rating: 1 });

        expect(res.status).toBe(403);
    });

    test('error 400: calificación inválida', async () => {
        reviewsRepo.findById.mockResolvedValue(review);

        const res = await request(app)
            .put('/api/reviews/5')
            .set('Authorization', tokens.ana)
            .send({ rating: 10 });

        expect(res.status).toBe(400);
    });

    test('error 404: la reseña no existe', async () => {
        reviewsRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/reviews/99')
            .set('Authorization', tokens.ana)
            .send({ rating: 3 });

        expect(res.status).toBe(404);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).put('/api/reviews/5').send({ rating: 3 });
        expect(res.status).toBe(401);
    });
});

describe('DELETE /api/reviews/:id', () => {
    test('éxito: el autor elimina su reseña', async () => {
        reviewsRepo.findById.mockResolvedValue(review);
        reviewsRepo.remove.mockResolvedValue(true);

        const res = await request(app).delete('/api/reviews/5').set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(reviewsRepo.remove).toHaveBeenCalledWith(5);
    });

    test('éxito: un administrador modera (elimina) reseñas ajenas', async () => {
        reviewsRepo.findById.mockResolvedValue(review);
        reviewsRepo.remove.mockResolvedValue(true);

        const res = await request(app).delete('/api/reviews/5').set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('error 403: otro usuario', async () => {
        reviewsRepo.findById.mockResolvedValue(review);

        const res = await request(app).delete('/api/reviews/5').set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
        expect(reviewsRepo.remove).not.toHaveBeenCalled();
    });

    test('error 404: no existe', async () => {
        reviewsRepo.findById.mockResolvedValue(null);

        const res = await request(app).delete('/api/reviews/99').set('Authorization', tokens.ana);

        expect(res.status).toBe(404);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).delete('/api/reviews/5');
        expect(res.status).toBe(401);
    });
});
