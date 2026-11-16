# GameVault API
API REST desarrollada con Node.js, Express y MySQL para el proyecto GameVault, una plataforma web orientada a la gestión y adquisición de videojuegos.

## Instalación y configuración
1. Instalar Node.js y MySQL, verificando que el servicio de MySQL esté funcionando.
2. Crear la base de datos `gamevault` utilizando `database/gamevault.sql`, únicamente si todavía no existe.
3. Copiar el archivo `.env.example`, renombrarlo como `.env` y configurar la conexión a MySQL y una clave privada `JWT_SECRET`.
4. Instalar las dependencias:
   ```bash
   npm ci
   ```

5. Iniciar el servidor:
   ```bash
   npm start
   ```

6. Comprobar el funcionamiento de la API mediante:
   ```http
   GET http://localhost:3000/api/health
   ```

No se deben compartir ni subir al repositorio el archivo `.env`, las contraseñas de MySQL o la clave utilizada para firmar los tokens JWT.

## Estructura y funcionamiento de la API
Las rutas, variables, funciones y campos JSON de la API utilizan nombres en inglés, siguiendo las convenciones de programación establecidas para el proyecto.
Los mensajes visibles para el usuario permanecen en español.
Los valores correspondientes a roles, estados de compra y tipos de logros se manejan en inglés. La clasificación por edad `TODOS` se conserva para mantener la compatibilidad con los datos existentes.
Las tablas y columnas de MySQL también utilizan nombres en inglés.

### Endpoints principales
| Método | Ruta | Funcionalidad |
| --- | --- | --- |
| GET | `/api/health` | Verificar el funcionamiento del servidor |
| POST | `/api/users` | Registrar usuarios |
| POST | `/api/sessions` | Iniciar sesión y generar un token JWT |
| GET/POST | `/api/video-games` | Consultar y registrar videojuegos |
| GET/POST | `/api/genres` | Consultar y registrar géneros |
| GET/POST | `/api/tags` | Consultar y registrar etiquetas |
| GET/POST | `/api/purchases` | Consultar y registrar compras según los permisos |
| GET/POST | `/api/reviews` | Consultar y registrar reseñas |
| GET | `/api/users/{id}/achievements` | Consultar el progreso de logros de un usuario |
| PATCH | `/api/users/{id}/password` | Actualizar la contraseña de un usuario |

Las operaciones protegidas requieren autenticación mediante JWT. Algunas funcionalidades están restringidas según el rol del usuario.

### Ejemplo de registro
```http
POST /api/users
Content-Type: application/json
```

```json
{
  "name": "Valentina Prueba",
  "email": "valentina@example.com",
  "password": "ExamplePassword123!",
  "accepted_terms": true
}
```

### Ejemplo de inicio de sesión
```http
POST /api/sessions
Content-Type: application/json
```

```json
{
  "email": "valentina@example.com",
  "password": "ExamplePassword123!"
}
```

Después de iniciar sesión, el servidor devuelve un token JWT que debe incluirse en las solicitudes protegidas:
```http
Authorization: Bearer <token>
```

La documentación interactiva de todos los endpoints está disponible en:
```text
http://localhost:3000/api-docs/
```

La especificación OpenAPI en formato JSON se encuentra en:
```text
http://localhost:3000/openapi.json
```

## Pruebas y validación
GameVault utiliza Jest y Supertest para ejecutar pruebas automatizadas de sus funcionalidades.
Para ejecutar las pruebas:
```bash
npm test
```

Para comprobar las consultas SQL representativas con resultados simulados de MySQL:
```bash
npm run check:sql-mapping
```

### Pruebas con Postman
La colección de Postman está ubicada en:
```text
pruebas/GameVault_Final.postman_collection.json
```

Esta colección contiene 93 solicitudes preparadas para comprobar casos exitosos y de error.
Para utilizarla:
1. Importar la colección en Postman.
2. Configurar la variable `baseUrl` con el valor `http://localhost:3000`.
3. Iniciar el servidor y verificar la conexión con MySQL.
4. Ejecutar las solicitudes utilizando los métodos, parámetros y cuerpos JSON correspondientes.
5. Configurar los tokens JWT cuando se necesite acceder a recursos protegidos.
Las solicitudes de Postman son plantillas de prueba y no constituyen por sí solas evidencia de ejecución.
Algunas operaciones modifican o eliminan registros de prueba, por lo que deben ejecutarse de manera controlada.

## Cambios realizados respecto al corte 2
Durante el corte 2, la API utilizaba rutas y campos JSON en español, como:
```text
/api/usuarios/registro
nombre
correo
contrasena
```

Posteriormente, se actualizaron para utilizar nombres en inglés y convenciones REST:
```text
POST /api/users
name
email
password
```

También se actualizaron las demás rutas, los parámetros, las respuestas JSON, la documentación Swagger y la colección de Postman.
La estructura física de MySQL se conservó, debido a que las tablas y columnas ya estaban definidas en inglés.
Este cambio permitió establecer un contrato de API uniforme para la integración con el frontend del tercer corte.

## Seguridad de la autenticación
GameVault implementa almacenamiento seguro de contraseñas utilizando el algoritmo Argon2id, con una sal aleatoria única para cada contraseña.
Esta implementación corresponde a una evolución del sistema desarrollado en el corte 2, donde las contraseñas todavía se almacenaban en texto plano.

### Implementación de seguridad
- Las contraseñas se transforman en hashes Argon2id del lado del servidor antes de almacenarse en MySQL.
- Cada contraseña utiliza una sal aleatoria generada automáticamente por Argon2id.
- El inicio de sesión verifica la contraseña ingresada mediante el hash almacenado.
- La actualización de contraseñas genera un nuevo hash.
- El registro y el cambio de contraseña requieren un mínimo de 15 caracteres.
- Las cuentas existentes conservan sus contraseñas originales después de la migración.
- Las contraseñas y sus hashes no se incluyen en las respuestas de la API.
- Los tokens JWT permiten identificar usuarios autenticados.
- Las operaciones protegidas verifican los permisos correspondientes.

### Migración de contraseñas existentes
En el corte 2, las contraseñas se almacenaban en texto plano.
Para el corte 3, se desarrolló un script de migración que transforma las contraseñas existentes en hashes Argon2id sin eliminar las cuentas ni modificar sus relaciones con los demás registros.
Antes de ejecutar la migración, se debe realizar una copia de seguridad de MySQL y detener el servidor.
El script se encuentra en:
```text
scripts/migrate-passwords.js
```

Para ejecutarlo:
```bash
node scripts/migrate-passwords.js
```

El procedimiento conserva la información de los usuarios y actualiza únicamente sus contraseñas.
La migración realizada sobre la base de datos de desarrollo permitió proteger cinco cuentas existentes.
Posteriormente, se registró un nuevo usuario y se comprobó que su contraseña también se almacenaba mediante Argon2id.
El respaldo anterior a la migración contiene contraseñas en texto plano y debe mantenerse privado, fuera del repositorio.

### Verificación de seguridad
La autenticación segura se verificó mediante pruebas funcionales en Postman, consultas en MySQL y pruebas automatizadas con Jest y Supertest.
Se comprobaron los siguientes escenarios:
- Registro de usuarios con contraseñas protegidas mediante Argon2id.
- Inicio de sesión correcto después de la migración.
- Inicio de sesión de nuevos usuarios.
- Rechazo de contraseñas incorrectas mediante HTTP 401.
- Rechazo de registros con contraseñas inferiores a 15 caracteres mediante HTTP 400.
- Actualización de contraseñas con generación de nuevos hashes.
- Rechazo de la contraseña anterior después de una actualización.
- Inicio de sesión exitoso utilizando la nueva contraseña.
- Verificación en MySQL del formato Argon2id almacenado.

### Resultados de las pruebas automatizadas
La ejecución general de Jest obtuvo los siguientes resultados:
- Suites aprobadas: 7 de 7.
- Pruebas aprobadas: 257 de 257.
- Pruebas fallidas: 0.
Estos resultados permiten comprobar el funcionamiento de los módulos evaluados y la compatibilidad de las modificaciones de autenticación con las pruebas existentes.
Las pruebas automatizadas no sustituyen la verificación funcional del sistema completo desde la interfaz web.

## Consideraciones de seguridad y despliegue
La implementación de Argon2id protege las contraseñas almacenadas, pero no elimina todos los riesgos relacionados con la autenticación.
Antes de utilizar GameVault en un entorno de producción se deben revisar aspectos adicionales como:
- Comunicación HTTPS.
- Protección de los tokens JWT.
- Configuración de CORS.
- Limitación de intentos de inicio de sesión.
- Gestión segura de variables de entorno.
- Actualización de dependencias con vulnerabilidades conocidas.
- Protección y eliminación segura de respaldos con contraseñas antiguas.
Estas medidas complementan la autenticación segura y permiten identificar futuras mejoras para la plataforma.

## Integración con el frontend
La API está preparada para recibir solicitudes HTTP desde la interfaz web desarrollada en HTML, CSS y JavaScript.
El frontend debe utilizar los endpoints documentados y respetar los permisos establecidos para usuarios y administradores.
La información presentada en la interfaz debe obtenerse mediante solicitudes reales a la API, sin sustituirlas por datos simulados.
Las operaciones deben mostrar estados visibles de carga, error y confirmación, de acuerdo con los requerimientos del tercer corte.
La integración completa con el frontend y sus pruebas funcionales forman parte de la etapa final del proyecto.