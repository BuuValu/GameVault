jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/genres.repository');
jest.mock('../repositories/tags.repository');

const request = require('supertest');
const app = require('../app');
const genresRepo = require('../repositories/genres.repository');
const tagsRepo = require('../repositories/tags.repository');
const { tokens, mysqlError } = require('./helpers');

beforeEach(() => {
    jest.resetAllMocks();
});

describe.each([
    {
        resource: 'genres',
        repo: genresRepo,
        primaryKey: 'genre_id',
        usageField: 'video_game_count',
        example: 'Acción'
    },
    {
        resource: 'tags',
        repo: tagsRepo,
        primaryKey: 'tag_id',
        usageField: 'review_count',
        example: 'Divertido'
    }
])('/api/$recurso', ({ resource, repo, primaryKey, usageField, example }) => {
    const url = `/api/${resource}`;
    const record = { [primaryKey]: 1, name: example, [usageField]: 0 };

    describe(`GET ${url}`, () => {
        test('éxito: lista pública', async () => {
            repo.list.mockResolvedValue([record]);

            const res = await request(app).get(url);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([record]);
        });

        test('error 503: la base de datos no responde', async () => {
            repo.list.mockRejectedValue(mysqlError('PROTOCOL_CONNECTION_LOST'));
            jest.spyOn(console, 'error').mockImplementation(() => {});

            const res = await request(app).get(url);

            expect(res.status).toBe(503);
        });
    });

    describe(`GET ${url}/:id`, () => {
        test('éxito', async () => {
            repo.findById.mockResolvedValue(record);

            const res = await request(app).get(`${url}/1`);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe(example);
        });

        test('error 404: no existe', async () => {
            repo.findById.mockResolvedValue(null);
            const res = await request(app).get(`${url}/99`);
            expect(res.status).toBe(404);
        });

        test('error 400: ID inválido', async () => {
            const res = await request(app).get(`${url}/uno`);
            expect(res.status).toBe(400);
        });
    });

    describe(`POST ${url}`, () => {
        test('éxito 201: crea y recorta espacios del nombre', async () => {
            repo.findByName.mockResolvedValue(null);
            repo.create.mockResolvedValue(record);

            const res = await request(app)
                .post(url)
                .set('Authorization', tokens.admin)
                .send({ name: `  ${example}  ` });

            expect(res.status).toBe(201);
            expect(repo.create).toHaveBeenCalledWith(example);
        });

        test('error 401: sin token', async () => {
            const res = await request(app).post(url).send({ name: example });
            expect(res.status).toBe(401);
        });

        test('error 403: usuario normal', async () => {
            const res = await request(app)
                .post(url)
                .set('Authorization', tokens.ana)
                .send({ name: example });
            expect(res.status).toBe(403);
        });

        test.each([
            ['nombre vacío', { name: '   ' }],
            ['sin nombre', {}],
            ['nombre no es texto', { name: 123 }],
            ['nombre demasiado largo', { name: 'x'.repeat(61) }]
        ])('error 400: %s', async (_case, requestBody) => {
            const res = await request(app)
                .post(url)
                .set('Authorization', tokens.admin)
                .send(requestBody);

            expect(res.status).toBe(400);
            expect(repo.create).not.toHaveBeenCalled();
        });

        test('error 409: nombre duplicado', async () => {
            repo.findByName.mockResolvedValue(record);

            const res = await request(app)
                .post(url)
                .set('Authorization', tokens.admin)
                .send({ name: example });

            expect(res.status).toBe(409);
        });

        test('error MySQL ER_DUP_ENTRY (carrera) → 409', async () => {
            repo.findByName.mockResolvedValue(null);
            repo.create.mockRejectedValue(mysqlError('ER_DUP_ENTRY'));

            const res = await request(app)
                .post(url)
                .set('Authorization', tokens.admin)
                .send({ name: example });

            expect(res.status).toBe(409);
        });
    });

    describe(`PUT ${url}/:id`, () => {
        test('éxito: renombra', async () => {
            repo.findById.mockResolvedValue(record);
            repo.findByName.mockResolvedValue(null);
            repo.update.mockResolvedValue({ ...record, name: 'Nuevo' });

            const res = await request(app)
                .put(`${url}/1`)
                .set('Authorization', tokens.admin)
                .send({ name: 'Nuevo' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Nuevo');
        });

        test('éxito: reenviar el mismo nombre no es conflicto', async () => {
            repo.findById.mockResolvedValue(record);
            repo.findByName.mockResolvedValue(record);
            repo.update.mockResolvedValue(record);

            const res = await request(app)
                .put(`${url}/1`)
                .set('Authorization', tokens.admin)
                .send({ name: example });

            expect(res.status).toBe(200);
        });

        test('error 404: no existe', async () => {
            repo.findById.mockResolvedValue(null);

            const res = await request(app)
                .put(`${url}/99`)
                .set('Authorization', tokens.admin)
                .send({ name: 'Nuevo' });

            expect(res.status).toBe(404);
        });

        test('error 409: el nombre es de otro registro', async () => {
            repo.findById.mockResolvedValue(record);
            repo.findByName.mockResolvedValue({ [primaryKey]: 2, name: 'Otro' });

            const res = await request(app)
                .put(`${url}/1`)
                .set('Authorization', tokens.admin)
                .send({ name: 'Otro' });

            expect(res.status).toBe(409);
        });

        test('error 400: nombre vacío', async () => {
            const res = await request(app)
                .put(`${url}/1`)
                .set('Authorization', tokens.admin)
                .send({ name: '' });

            expect(res.status).toBe(400);
        });

        test('error 403: usuario normal', async () => {
            const res = await request(app)
                .put(`${url}/1`)
                .set('Authorization', tokens.ana)
                .send({ name: 'Nuevo' });

            expect(res.status).toBe(403);
        });
    });

    describe(`DELETE ${url}/:id`, () => {
        test('éxito: elimina un registro sin uso', async () => {
            repo.findById.mockResolvedValue(record);
            repo.remove.mockResolvedValue(true);

            const res = await request(app)
                .delete(`${url}/1`)
                .set('Authorization', tokens.admin);

            expect(res.status).toBe(200);
            expect(repo.remove).toHaveBeenCalledWith(1);
        });

        test('error 409: está en uso', async () => {
            repo.findById.mockResolvedValue({ ...record, [usageField]: 3 });

            const res = await request(app)
                .delete(`${url}/1`)
                .set('Authorization', tokens.admin);

            expect(res.status).toBe(409);
            expect(repo.remove).not.toHaveBeenCalled();
        });

        test('error MySQL ER_ROW_IS_REFERENCED_2 → 409', async () => {
            repo.findById.mockResolvedValue(record);
            repo.remove.mockRejectedValue(mysqlError('ER_ROW_IS_REFERENCED_2'));

            const res = await request(app)
                .delete(`${url}/1`)
                .set('Authorization', tokens.admin);

            expect(res.status).toBe(409);
        });

        test('error 404: no existe', async () => {
            repo.findById.mockResolvedValue(null);

            const res = await request(app)
                .delete(`${url}/99`)
                .set('Authorization', tokens.admin);

            expect(res.status).toBe(404);
        });

        test('error 403: usuario normal', async () => {
            const res = await request(app)
                .delete(`${url}/1`)
                .set('Authorization', tokens.ana);

            expect(res.status).toBe(403);
        });
    });
});
