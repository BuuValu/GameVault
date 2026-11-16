
const argon2 = require('argon2');
const pool = require('../src/config/db');

async function migratePasswords() {
    let connection;

    try {
        connection = await pool.getConnection();

        const [columns] = await connection.execute(`
            SELECT CHARACTER_MAXIMUM_LENGTH AS max_length
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND COLUMN_NAME = 'password'
        `);

        if (!columns.length || columns[0].max_length < 255) {
            throw new Error('La columna password debe admitir 255 caracteres.');
        }

        await connection.beginTransaction();

        const [users] = await connection.query(
            'SELECT user_id, password FROM users FOR UPDATE'
        );

        let migrated = 0;

        for (const user of users) {
            if (typeof user.password !== 'string' || !user.password) {
                throw new Error(`Contraseña inválida para usuario ${user.user_id}`);
            }

            if (user.password.startsWith('$argon2id$')) {
                continue;
            }

            if (/^\$(argon2|2[aby])/.test(user.password)) {
                throw new Error(`Formato de hash no esperado: usuario ${user.user_id}`);
            }

            const passwordHash = await argon2.hash(user.password, {
                type: argon2.argon2id
            });

            await connection.execute(
                'UPDATE users SET password = ? WHERE user_id = ?',
                [passwordHash, user.user_id]
            );

            migrated++;
        }

        await connection.commit();
        console.log(`Migración completada: ${migrated} usuarios actualizados.`);
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error('Error de migración:', error.message);
        process.exitCode = 1;
    } finally {
        if (connection) {
            connection.release();
        }

        await pool.end();
    }
}

migratePasswords();