const jwt = require('jsonwebtoken');
const usersService = require('../services/users.service');

async function register(req, res) {
    const user = await usersService.register(req.body);

    res.status(201)
        .location(`/api/users/${user.user_id}`)
        .json({
            message: 'Usuario registrado correctamente.',
            user
        });
}

async function login(req, res) {
    const user = await usersService.login(req.body);

    const token = jwt.sign(
        {
            user_id: user.user_id,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );

    res.status(200).json({
        message: 'Inicio de sesión exitoso.',
        token,
        user
    });
}

async function list(req, res) {
    res.status(200).json(await usersService.list());
}

async function getById(req, res) {
    res.status(200).json(await usersService.getById(req.params.id));
}

async function update(req, res) {
    const user = await usersService.update(req.params.id, req.body);

    res.status(200).json({
        message: 'Usuario actualizado correctamente.',
        user
    });
}

async function changePassword(req, res) {
    const user = await usersService.changePassword(
        req.params.id,
        req.body
    );

    res.status(200).json({
        message: 'Contraseña actualizada correctamente.',
        user
    });
}

async function remove(req, res) {
    res.status(200).json(await usersService.remove(req.params.id));
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
