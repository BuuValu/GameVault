const argon2 = require('argon2');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const usersRepository = require('../repositories/users.repository');
require('./helpers');
const app = require('../app');

jest.mock('../repositories/users.repository');

describe('API de usuarios', () => {
    beforeEach(() => jest.clearAllMocks());

    test('GET /api/health responde 200 y confirma que la API funciona', async () => {
        const response = await request(app).get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
    });

    test('GET /api/users/:id sin token responde 401', async () => {
        const response = await request(app).get('/api/users/1');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe(
            'Debes iniciar sesión para acceder a este recurso.'
        );
    });

    test('POST /api/users registers with Argon2id', async () => {
        usersRepository.findByEmail.mockResolvedValue(null);
        usersRepository.create.mockResolvedValue({
            user_id: 4,
            name: 'Val',
            email: 'val@example.com',
            role: 'user',
            accepted_terms: 1
        });

        const response = await request(app).post('/api/users').send({
            name: 'Val',
            email: 'val@example.com',
            password: 'GameVaultSecure2026!',
            accepted_terms: true
        });

        expect(response.status).toBe(201);
        expect(response.headers.location).toBe('/api/users/4');
        expect(response.body.user.user_id).toBe(4);

        expect(usersRepository.create).toHaveBeenCalledWith({
            name: 'Val',
            email: 'val@example.com',
            password: expect.stringMatching(/^\$argon2id\$/),
            accepted_terms: true
        });

        const savedPassword = usersRepository.create.mock.calls[0][0].password;

        expect(
            await argon2.verify(savedPassword, 'GameVaultSecure2026!')
        ).toBe(true);
    });

    test('POST /api/sessions verifies Argon2id password', async () => {
        const passwordHash = await argon2.hash('GameVaultSecure2026!', {
            type: argon2.argon2id
        });

        usersRepository.findByEmail.mockResolvedValue({
            user_id: 4,
            name: 'Val',
            email: 'val@example.com',
            password: passwordHash,
            role: 'user'
        });

        const response = await request(app).post('/api/sessions').send({
            email: 'val@example.com',
            password: 'GameVaultSecure2026!'
        });

        expect(response.status).toBe(200);
        expect(response.body.user).not.toHaveProperty('password');

        expect(
            jwt.verify(response.body.token, process.env.JWT_SECRET)
        ).toMatchObject({
            user_id: 4,
            role: 'user'
        });
    });

    test('POST /api/sessions rechaza credenciales incorrectas', async () => {
        usersRepository.findByEmail.mockResolvedValue(null);

        const response = await request(app).post('/api/sessions').send({
            email: 'nobody@example.com', password: 'wrong-password'
        });

        expect(response.status).toBe(401);
    });


    test('POST /api/sessions rejects an incorrect password', async () => {
        const passwordHash = await argon2.hash('GameVaultSecure2026!', {
            type: argon2.argon2id
        });

        usersRepository.findByEmail.mockResolvedValue({
            user_id: 4,
            name: 'Val',
            email: 'val@example.com',
            password: passwordHash,
            role: 'user'
        });

        const response = await request(app).post('/api/sessions').send({
            email: 'val@example.com',
            password: 'IncorrectPassword2026!'
        });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe(
            'Correo o contraseña incorrectos.'
        );
    });



    test('POST /api/users rejects passwords shorter than 15 characters', async () => {
        const response = await request(app).post('/api/users').send({
            name: 'Test User',
            email: 'shortpassword@example.com',
            password: 'GameVault12345',
            accepted_terms: true
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
    });




    test('PATCH /api/users/:id/password stores an Argon2id hash', async () => {
        usersRepository.findById.mockResolvedValue({
            user_id: 4,
            name: 'Val',
            email: 'val@example.com',
            role: 'user'
        });

        usersRepository.updatePassword.mockResolvedValue({
            user_id: 4,
            name: 'Val',
            email: 'val@example.com',
            role: 'user'
        });

        const token = jwt.sign(
            { user_id: 4, role: 'user' },
            process.env.JWT_SECRET
        );

        const response = await request(app)
            .patch('/api/users/4/password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                password: 'NewGameVaultPassword2026!'
            });

        expect(response.status).toBe(200);
        expect(usersRepository.updatePassword).toHaveBeenCalledWith(
            4,
            expect.stringMatching(/^\$argon2id\$/)
        );

        const savedHash = usersRepository.updatePassword.mock.calls[0][1];

        expect(
            await argon2.verify(savedHash, 'NewGameVaultPassword2026!')
        ).toBe(true);
    });




});