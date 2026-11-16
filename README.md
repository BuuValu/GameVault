# GameVault 

**GameVault** es una aplicación web para consultar un catálogo de videojuegos, gestionar compras, escribir reseñas y visualizar logros. Incluye un **panel de administración** para gestionar videojuegos, usuarios y compras.

El proyecto integra un frontend en **HTML, CSS y JavaScript** con una **API REST desarrollada en Node.js y Express** y una base de datos relacional **MySQL**. Fue desarrollado como proyecto académico.

## 1. Tecnologías utilizadas

| Componente | Tecnologías |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Node.js, Express |
| Base de datos | MySQL 8, `mysql2` |
| Autenticación | JSON Web Tokens (JWT) y Argon2id |
| Documentación de API | OpenAPI y Swagger UI |
| Pruebas | Jest, Supertest y Postman |
| Control de versiones | Git y GitHub |

## 2. Funcionalidades

### Usuario

- Registro con aceptación de términos e inicio de sesión.
- Consulta y búsqueda de videojuegos por catálogo.
- Visualización de detalles, precio y categorías de los juegos.
- Creación de solicitudes de compra y consulta de su estado.
- Biblioteca personal con los videojuegos adquiridos mediante compras confirmadas.
- Publicación y consulta de reseñas, de acuerdo con las reglas del backend.
- Consulta de logros y seguimiento del progreso asociado a la cuenta.
- Visualización de información y estadísticas del perfil.

### Administrador

- Acceso a un panel reservado para cuentas con rol `administrator`.
- Creación, actualización y administración de videojuegos.
- Consulta y gestión de usuarios.
- Consulta de compras y actualización de sus estados permitidos.
- Administración de la información del catálogo mediante los endpoints autorizados.

## 3. Estructura del proyecto

```text
GameVault/
├── database/
│   ├── gamevault.sql
│   └── migraciones/
├── docs/
├── pruebas/
├── public/
│   ├── images/
│   │   ├── genshin.png
│   │   ├── hollow-knight.png
│   │   └── minecraft.jpg
│   ├── index.html
│   ├── style.css
│   ├── main.js
│   ├── admin.js
│   ├── config.js
│   ├── visual-fixes.css
│   └── visual-fixes.js
├── scripts/
│   ├── migrate-passwords.js
│   └── check-mysql-mapping.js
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   └── tests/
├── server.js
├── package.json
└── README.md
```

## 4. Requisitos previos

- Node.js y npm instalados.
- MySQL 8.0.16 o superior, con el servicio activo.
- Una base de datos local accesible desde MySQL Workbench u otro cliente SQL.
- Git, si se desea clonar el repositorio.

## 5. Instalación y ejecución local

### Paso 1. Obtener el código

```bash
git clone https://github.com/BuuValu/GameVault.git
cd GameVault
```

Si ya tienes el proyecto descargado, simplemente abre su carpeta en VS Code.

### Paso 2. Preparar MySQL

Para una **instalación nueva**, ejecuta `database/gamevault.sql` en MySQL Workbench. Este archivo crea el esquema `gamevault` y sus tablas.

**Si ya tienes una base `gamevault` con usuarios, compras, reseñas o logros, no la borres ni la vuelvas a crear.** Conserva tus datos y aplica únicamente las migraciones que realmente correspondan a tu versión.

### Paso 3. Configurar las variables de entorno

Copia `.env.example` como `.env` (o crea el archivo `.env` si no existe el ejemplo) en la raíz del proyecto y configura tus valores locales:

```dotenv
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=TU_CONTRASENA_LOCAL
DB_NAME=gamevault
JWT_SECRET=UN_SECRETO_LARGO_PRIVADO_Y_ALEATORIO
```

No subas `.env` a GitHub ni compartas tu contraseña de MySQL o tu secreto JWT. El archivo `.gitignore` excluye los archivos locales de entorno.

### Paso 4. Instalar las dependencias

```bash
npm ci
```

### Paso 5. Iniciar la aplicación

```bash
npm start
```

Abre las siguientes direcciones en el navegador:

| Recurso | Dirección |
| --- | --- |
| Aplicación web | http://localhost:3000 |
| Comprobación de la API | http://localhost:3000/api/health |
| Documentación Swagger | http://localhost:3000/api-docs |
| Especificación OpenAPI | http://localhost:3000/openapi.json |

El servidor Express entrega **el frontend y la API desde el mismo puerto**. `public/config.js` configura `window.GAMEVAULT_API_BASE = '/api'`.

**Importante:** abre GameVault desde `http://localhost:3000`, no directamente desde el archivo `public/index.html`, para usar la autenticación y los datos reales de MySQL en lugar del modo de demostración local.

## 6. Autenticación y seguridad

- Las contraseñas nuevas se almacenan mediante **hash Argon2id con salt**, no en texto plano.
- El registro y el cambio de contraseña exigen una longitud mínima de **15 caracteres**.
- El inicio de sesión devuelve un **JWT** que se envía a las rutas protegidas mediante la cabecera `Authorization: Bearer <token>`.
- Los tokens de sesión tienen una duración configurada de **2 horas**.
- Los permisos se verifican en el backend mediante roles: `user` y `administrator`.
- Las operaciones administrativas requieren autenticación y autorización; el acceso a recursos de otros usuarios también está restringido.
- Las validaciones del backend y las restricciones de MySQL ayudan a prevenir operaciones y estados inválidos.

### Migración de contraseñas antiguas

El proyecto incluye `scripts/migrate-passwords.js` para convertir contraseñas antiguas almacenadas en texto plano a Argon2id. **No lo ejecutes por rutina sobre una base de datos que ya funciona**: úsalo únicamente si necesitas migrar una instalación antigua, después de realizar una copia de seguridad y revisar los requisitos del script.

Estas medidas forman parte de la implementación académica; no constituyen por sí solas una certificación de seguridad para producción.

## 7. API REST

Los nombres de rutas y campos JSON del backend están en inglés.

| Método | Endpoint | Función |
| --- | --- | --- |
| `GET` | `/api/health` | Verificar el estado del servicio |
| `POST` | `/api/users` | Registrar un usuario |
| `POST` | `/api/sessions` | Iniciar sesión y obtener un JWT |
| `GET` | `/api/video-games` | Consultar videojuegos |
| `POST` | `/api/video-games` | Crear un videojuego (administrador) |
| `GET` | `/api/genres` | Consultar géneros |
| `GET` | `/api/tags` | Consultar etiquetas |
| `POST` | `/api/purchases` | Crear una solicitud de compra |
| `PATCH` | `/api/purchases/{id}/status` | Actualizar estado de compra (administrador) |
| `GET` | `/api/users/{id}/purchases` | Consultar compras del usuario |
| `GET` | `/api/reviews` | Consultar reseñas |
| `POST` | `/api/reviews` | Publicar una reseña |
| `GET` | `/api/video-games/{id}/achievements` | Consultar logros de un videojuego |
| `GET` | `/api/users/{id}/achievements` | Consultar el progreso de logros de un usuario |
| `PUT` | `/api/users/{id}/achievements/{achievementId}` | Registrar progreso de un logro |

La documentación completa de métodos, cuerpos de solicitud y respuestas se encuentra en **Swagger UI** (`/api-docs`).

Los códigos HTTP utilizados incluyen `401` para solicitudes sin autenticación válida, `403` para operaciones sin permiso y `409` para determinados conflictos de reglas de negocio.

## 8. Pruebas

Para ejecutar las pruebas automatizadas del backend:

```bash
npm test
```

Para comprobar el mapeo de consultas SQL con resultados simulados:

```bash
npm run check:sql-mapping
```

La colección Postman está en `pruebas/GameVault_Final.postman_collection.json`. Configura su variable `baseUrl` en `http://localhost:3000` y utiliza tokens de prueba para las rutas protegidas. Algunas solicitudes modifican datos; ejecútalas únicamente en un entorno apropiado.

Entre los flujos revisados durante el desarrollo se encuentran el registro, el inicio de sesión, la autorización por roles, la gestión del catálogo, el cambio de estado de compras, las reseñas y el progreso de logros.

## 9. Consideraciones de uso

- El frontend requiere que el servidor Express y MySQL estén disponibles.
- Las portadas locales del catálogo de demostración se encuentran en `public/images/` y se aplican mediante los archivos de ajustes visuales.
- No se incluyen credenciales privadas ni contraseñas de cuentas de prueba en este README.
- No ejecutes scripts de creación o migración sobre una base existente sin verificar previamente su efecto.
