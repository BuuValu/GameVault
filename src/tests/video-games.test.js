jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/video-games.repository');
jest.mock('../repositories/genres.repository');

const request = require('supertest');
const app = require('../app');
const repo = require('../repositories/video-games.repository');
const genresRepo = require('../repositories/genres.repository');
const { tokens, videoGame, mysqlError } = require('./helpers');

const validData = {
    name: 'Zelda',
    description: 'Aventura épica',
    price: 59.99,
    age_rating: '12+',
    genres: [1]
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('GET /api/video-games', () => {
    test('éxito: el público recibe solo videojuegos activos, paginados', async () => {
        repo.list.mockResolvedValue({ total: 1, videoGames: [videoGame] });

        const res = await request(app).get('/api/video-games');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 1, pages: 1 });
        expect(repo.list.mock.calls[0][0].active).toBe(true);
    });

    test('éxito: un administrador puede ver todos con ?is_active=all', async () => {
        repo.list.mockResolvedValue({ total: 0, videoGames: [] });

        const res = await request(app)
            .get('/api/video-games?is_active=all')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
        expect(repo.list.mock.calls[0][0].active).toBeUndefined();
    });

    test('éxito: los filtros llegan al repositorio', async () => {
        repo.list.mockResolvedValue({ total: 0, videoGames: [] });

        await request(app).get(
            '/api/video-games?q=zel&genre=2&min_price=10&max_price=80&sort=price_asc&page=2&limit=5'
        );

        expect(repo.list.mock.calls[0][0]).toMatchObject({
            search: 'zel',
            genreId: 2,
            minPrice: 10,
            maxPrice: 80,
            sortOrder: 'price_asc',
            limit: 5,
            offset: 5
        });
    });

    test('error 400: orden no permitido', async () => {
        const res = await request(app).get('/api/video-games?sort=hackeo');
        expect(res.status).toBe(400);
    });

    test('error 400: limite fuera de rango', async () => {
        const res = await request(app).get('/api/video-games?limit=0');
        expect(res.status).toBe(400);
    });

    test('error 400: min_price mayor que max_price', async () => {
        const res = await request(app).get('/api/video-games?min_price=50&max_price=10');
        expect(res.status).toBe(400);
    });

    test('error 401: token enviado pero inválido', async () => {
        const res = await request(app)
            .get('/api/video-games')
            .set('Authorization', tokens.invalid);
        expect(res.status).toBe(401);
    });
});

describe('GET /api/video-games/:id', () => {
    test('éxito: devuelve el videojuego con sus géneros', async () => {
        repo.findById.mockResolvedValue(videoGame);

        const res = await request(app).get('/api/video-games/1');

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Zelda');
        expect(res.body.genres).toHaveLength(1);
    });

    test('éxito: un administrador ve un videojuego inactivo', async () => {
        repo.findById.mockResolvedValue({ ...videoGame, is_active: false });

        const res = await request(app)
            .get('/api/video-games/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('error 404: no existe', async () => {
        repo.findById.mockResolvedValue(null);
        const res = await request(app).get('/api/video-games/999');
        expect(res.status).toBe(404);
    });

    test('error 404: inactivo para el público', async () => {
        repo.findById.mockResolvedValue({ ...videoGame, is_active: false });
        const res = await request(app).get('/api/video-games/1');
        expect(res.status).toBe(404);
    });

    test('error 400: ID no numérico', async () => {
        const res = await request(app).get('/api/video-games/abc');
        expect(res.status).toBe(400);
    });
});

describe('POST /api/video-games', () => {
    function prepareCreation() {
        repo.findByName.mockResolvedValue(null);
        genresRepo.findExistingIds.mockResolvedValue([1]);
        repo.create.mockResolvedValue(videoGame);
    }

    test('éxito 201: crea el videojuego con sus géneros y devuelve Location', async () => {
        prepareCreation();

        const res = await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.admin)
            .send(validData);

        expect(res.status).toBe(201);
        expect(res.headers.location).toBe('/api/video-games/1');
        expect(repo.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Zelda', is_active: true }),
            [1]
        );
    });

    test('éxito: normaliza la clasificación a mayúsculas', async () => {
        prepareCreation();

        await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.admin)
            .send({ ...validData, age_rating: 'todos' });

        expect(repo.create.mock.calls[0][0].age_rating).toBe('TODOS');
    });

    test('error 401: sin token', async () => {
        const res = await request(app).post('/api/video-games').send(validData);
        expect(res.status).toBe(401);
    });

    test('error 403: un usuario normal no puede crear', async () => {
        const res = await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.ana)
            .send(validData);
        expect(res.status).toBe(403);
    });

    test.each([
        ['precio negativo', { price: -5 }],
        ['precio con 3 decimales', { price: 1.234 }],
        ['precio como texto', { price: '10' }],
        ['nombre vacío', { name: '   ' }],
        ['descripción ausente', { description: undefined }],
        ['clasificación inválida', { age_rating: 'XX' }],
        ['URL de imagen inválida', { image_url: 'ftp://servidor/img.png' }],
        ['activo no booleano', { is_active: 'si' }],
        ['generos no es arreglo', { genres: 'accion' }]
    ])('error 400: %s', async (_name, change) => {
        const res = await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.admin)
            .send({ ...validData, ...change });

        expect(res.status).toBe(400);
        expect(repo.create).not.toHaveBeenCalled();
    });

    test('error 400: algún género no existe', async () => {
        repo.findByName.mockResolvedValue(null);
        genresRepo.findExistingIds.mockResolvedValue([]);

        const res = await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.admin)
            .send({ ...validData, genres: [99] });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('99');
    });

    test('error 400: JSON mal formado', async () => {
        const res = await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.admin)
            .set('Content-Type', 'application/json')
            .send('{"name":');

        expect(res.status).toBe(400);
    });

    test('error 409: ya existe un videojuego con ese nombre', async () => {
        genresRepo.findExistingIds.mockResolvedValue([1]);
        repo.findByName.mockResolvedValue({ video_game_id: 9, name: 'Zelda' });

        const res = await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.admin)
            .send(validData);

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_DUP_ENTRY (carrera entre solicitudes) → 409', async () => {
        prepareCreation();
        repo.create.mockRejectedValue(mysqlError('ER_DUP_ENTRY'));

        const res = await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.admin)
            .send(validData);

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_NO_REFERENCED_ROW_2 → 400', async () => {
        prepareCreation();
        repo.create.mockRejectedValue(mysqlError('ER_NO_REFERENCED_ROW_2'));

        const res = await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.admin)
            .send(validData);

        expect(res.status).toBe(400);
    });

    test('error MySQL caída de la base de datos → 503', async () => {
        prepareCreation();
        repo.create.mockRejectedValue(mysqlError('ECONNREFUSED'));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.admin)
            .send(validData);

        expect(res.status).toBe(503);
    });

    test('error inesperado → 500 sin filtrar detalles internos', async () => {
        prepareCreation();
        repo.create.mockRejectedValue(new Error('detalle interno secreto'));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .post('/api/video-games')
            .set('Authorization', tokens.admin)
            .send(validData);

        expect(res.status).toBe(500);
        expect(JSON.stringify(res.body)).not.toContain('secreto');
    });
});

describe('PUT /api/video-games/:id', () => {
    test('éxito: reemplaza los datos y conserva `activo` si se omite', async () => {
        repo.findById.mockResolvedValue({ ...videoGame, is_active: false });
        repo.findByName.mockResolvedValue({ video_game_id: 1, name: 'Zelda' });
        genresRepo.findExistingIds.mockResolvedValue([1]);
        repo.update.mockResolvedValue({ ...videoGame, price: 49.5 });

        const res = await request(app)
            .put('/api/video-games/1')
            .set('Authorization', tokens.admin)
            .send({ ...validData, price: 49.5 });

        expect(res.status).toBe(200);
        expect(repo.update.mock.calls[0][1].is_active).toBe(false);
    });

    test('error 404: el videojuego no existe', async () => {
        repo.findById.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/video-games/999')
            .set('Authorization', tokens.admin)
            .send(validData);

        expect(res.status).toBe(404);
    });

    test('error 400: PUT con datos incompletos', async () => {
        repo.findById.mockResolvedValue(videoGame);

        const res = await request(app)
            .put('/api/video-games/1')
            .set('Authorization', tokens.admin)
            .send({ name: 'Zelda' });

        expect(res.status).toBe(400);
    });

    test('error 409: el nuevo nombre pertenece a otro videojuego', async () => {
        repo.findById.mockResolvedValue(videoGame);
        genresRepo.findExistingIds.mockResolvedValue([1]);
        repo.findByName.mockResolvedValue({ video_game_id: 2, name: 'Zelda' });

        const res = await request(app)
            .put('/api/video-games/1')
            .set('Authorization', tokens.admin)
            .send(validData);

        expect(res.status).toBe(409);
    });

    test('error 403: un usuario normal', async () => {
        const res = await request(app)
            .put('/api/video-games/1')
            .set('Authorization', tokens.ana)
            .send(validData);
        expect(res.status).toBe(403);
    });
});

describe('PATCH /api/video-games/:id', () => {
    test('éxito: cambia solo el precio y mantiene el resto', async () => {
        repo.findById.mockResolvedValue(videoGame);
        repo.findByName.mockResolvedValue({ video_game_id: 1, name: 'Zelda' });
        repo.update.mockResolvedValue({ ...videoGame, price: 39.99 });

        const res = await request(app)
            .patch('/api/video-games/1')
            .set('Authorization', tokens.admin)
            .send({ price: 39.99 });

        expect(res.status).toBe(200);
        expect(repo.update.mock.calls[0][1]).toMatchObject({
            name: 'Zelda',
            price: 39.99
        });
        expect(repo.update.mock.calls[0][2]).toBeUndefined();
    });

    test('éxito: desactivar un videojuego (alternativa a eliminarlo)', async () => {
        repo.findById.mockResolvedValue(videoGame);
        repo.findByName.mockResolvedValue({ video_game_id: 1, name: 'Zelda' });
        repo.update.mockResolvedValue({ ...videoGame, is_active: false });

        const res = await request(app)
            .patch('/api/video-games/1')
            .set('Authorization', tokens.admin)
            .send({ is_active: false });

        expect(res.status).toBe(200);
        expect(repo.update.mock.calls[0][1].is_active).toBe(false);
    });

    test('error 400: cuerpo sin campos reconocidos', async () => {
        const res = await request(app)
            .patch('/api/video-games/1')
            .set('Authorization', tokens.admin)
            .send({ otherField: 1 });

        expect(res.status).toBe(400);
    });

    test('error 400: valor inválido', async () => {
        repo.findById.mockResolvedValue(videoGame);

        const res = await request(app)
            .patch('/api/video-games/1')
            .set('Authorization', tokens.admin)
            .send({ price: -1 });

        expect(res.status).toBe(400);
    });

    test('error 404: no existe', async () => {
        repo.findById.mockResolvedValue(null);

        const res = await request(app)
            .patch('/api/video-games/999')
            .set('Authorization', tokens.admin)
            .send({ price: 10 });

        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/video-games/:id', () => {
    test('éxito: elimina un videojuego sin compras', async () => {
        repo.findById.mockResolvedValue(videoGame);
        repo.hasPurchases.mockResolvedValue(false);
        repo.remove.mockResolvedValue(true);

        const res = await request(app)
            .delete('/api/video-games/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
        expect(repo.remove).toHaveBeenCalledWith(1);
    });

    test('error 409: tiene compras registradas (se sugiere desactivar)', async () => {
        repo.findById.mockResolvedValue(videoGame);
        repo.hasPurchases.mockResolvedValue(true);

        const res = await request(app)
            .delete('/api/video-games/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('Desactívalo');
        expect(repo.remove).not.toHaveBeenCalled();
    });

    test('error MySQL ER_ROW_IS_REFERENCED_2 (compra creada justo antes) → 409', async () => {
        repo.findById.mockResolvedValue(videoGame);
        repo.hasPurchases.mockResolvedValue(false);
        repo.remove.mockRejectedValue(mysqlError('ER_ROW_IS_REFERENCED_2'));

        const res = await request(app)
            .delete('/api/video-games/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(409);
    });

    test('error 404: no existe', async () => {
        repo.findById.mockResolvedValue(null);

        const res = await request(app)
            .delete('/api/video-games/999')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });

    test('error 403: un usuario normal', async () => {
        const res = await request(app)
            .delete('/api/video-games/1')
            .set('Authorization', tokens.ana);
        expect(res.status).toBe(403);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).delete('/api/video-games/1');
        expect(res.status).toBe(401);
    });
});

describe('Géneros de un videojuego (N:M)', () => {
    test('GET /:id/generos éxito', async () => {
        repo.findById.mockResolvedValue(videoGame);

        const res = await request(app).get('/api/video-games/1/genres');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(videoGame.genres);
    });

    test('GET /:id/generos error 404', async () => {
        repo.findById.mockResolvedValue(null);
        const res = await request(app).get('/api/video-games/9/genres');
        expect(res.status).toBe(404);
    });

    test('PUT /:id/genres/:genreId éxito 201 cuando es nuevo', async () => {
        repo.findById.mockResolvedValue(videoGame);
        genresRepo.findById.mockResolvedValue({ genre_id: 2, name: 'RPG' });
        repo.addGenre.mockResolvedValue(true);

        const res = await request(app)
            .put('/api/video-games/1/genres/2')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(201);
    });

    test('PUT /:id/genres/:genreId es idempotente: 200 si ya existía', async () => {
        repo.findById.mockResolvedValue(videoGame);
        genresRepo.findById.mockResolvedValue({ genre_id: 1, name: 'Acción' });
        repo.addGenre.mockResolvedValue(false);

        const res = await request(app)
            .put('/api/video-games/1/genres/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('PUT /:id/genres/:genreId error 404: el género no existe', async () => {
        repo.findById.mockResolvedValue(videoGame);
        genresRepo.findById.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/video-games/1/genres/99')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });

    test('PUT /:id/genres/:genreId error 403: usuario normal', async () => {
        const res = await request(app)
            .put('/api/video-games/1/genres/2')
            .set('Authorization', tokens.ana);
        expect(res.status).toBe(403);
    });

    test('DELETE /:id/genres/:genreId éxito', async () => {
        repo.findById.mockResolvedValue(videoGame);
        repo.removeGenre.mockResolvedValue(true);

        const res = await request(app)
            .delete('/api/video-games/1/genres/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('DELETE /:id/genres/:genreId error 404: no estaba asociado', async () => {
        repo.findById.mockResolvedValue(videoGame);
        repo.removeGenre.mockResolvedValue(false);

        const res = await request(app)
            .delete('/api/video-games/1/genres/5')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });
});
