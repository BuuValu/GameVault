const argon2 = require('argon2');
const usersRepository = require('../repositories/users.repository');
const { httpError } = require('../utils/errors');
const {
    requestBody,
    parseRouteId,
    requireText
} = require('../utils/validations');

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 150;
const MIN_PASSWORD_LENGTH = 15;
const MAX_PASSWORD_LENGTH = 100;

function validateEmail(value) {
    const email = requireText(value, 'El correo', MAX_EMAIL_LENGTH).toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw httpError('Debes ingresar un correo válido.');
    }

    return email;
}

function validatePassword(value) {
    if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
        throw httpError(
            `La contraseña debe tener mínimo ${MIN_PASSWORD_LENGTH} caracteres.`
        );
    }

    if (value.length > MAX_PASSWORD_LENGTH) {
        throw httpError(
            `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres.`
        );
    }

    return value;
}

async function register(body) {
    const data = requestBody(body);

    const name = requireText(data.name, 'El nombre', MAX_NAME_LENGTH);
    const email = validateEmail(data.email);
    const password = validatePassword(data.password);

    if (data.accepted_terms !== true) {
        throw httpError('Debes aceptar los términos y condiciones.');
    }

    if (await usersRepository.findByEmail(email)) {
        throw httpError('El correo ya está registrado.', 409);
    }

    const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id
    });

    return usersRepository.create({
        name,
        email,
        password: passwordHash,
        accepted_terms: true
    });
}

async function login(body) {
    const { email, password } = requestBody(body);

    if (
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        !email.trim() ||
        !password
    ) {
        throw httpError('Debes ingresar correo y contraseña.');
    }

    const user = await usersRepository.findByEmail(
        email.trim().toLowerCase()
    );

    if (!user || !user.password.startsWith('$argon2id$')) {
    throw httpError('Correo o contraseña incorrectos.', 401);
    }

    const passwordIsValid = await argon2.verify(
        user.password,
        password
    );

    if (!passwordIsValid) {
        throw httpError('Correo o contraseña incorrectos.', 401);
    }

    const publicUser = { ...user };
    delete publicUser.password;

    return publicUser;
}

async function list() {
    return usersRepository.list();
}

async function getById(id) {
    const user = await usersRepository.findById(parseRouteId(id));

    if (!user) {
        throw httpError('Usuario no encontrado.', 404);
    }

    return user;
}

async function update(id, body) {
    const validId = parseRouteId(id);
    const data = requestBody(body);

    const name = requireText(data.name, 'El nombre', MAX_NAME_LENGTH);
    const email = validateEmail(data.email);

    if (!(await usersRepository.findById(validId))) {
        throw httpError('Usuario no encontrado.', 404);
    }

    const userWithEmail = await usersRepository.findByEmail(email);

    if (userWithEmail && userWithEmail.user_id !== validId) {
        throw httpError('Ese correo ya pertenece a otro usuario.', 409);
    }

    return usersRepository.update(validId, { name, email });
}

async function changePassword(id, body) {
    const validId = parseRouteId(id);
    const password = validatePassword(requestBody(body).password);

    if (!(await usersRepository.findById(validId))) {
        throw httpError('Usuario no encontrado.', 404);
    }

    const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id
    });

    return usersRepository.updatePassword(validId, passwordHash);
}

async function remove(id) {
    const deleted = await usersRepository.remove(parseRouteId(id));

    if (!deleted) {
        throw httpError('Usuario no encontrado.', 404);
    }

    return { message: 'Usuario eliminado correctamente.' };
}

module.exports = {
    register,
    login,
    list,
    getById,
    update,
    changePassword,
    remove
};
