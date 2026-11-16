function isAdmin(user) {
    return user.role === 'administrator';
}

module.exports = { isAdmin };
