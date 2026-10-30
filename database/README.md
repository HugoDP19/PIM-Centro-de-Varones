# Base de datos

Destino: MySQL 8 y codificación utf8mb4. Esta fase no define tablas ni crea bases de datos.

La configuración está en `src/database.js`. Completar `.env` y ejecutar `npm run db:check` para realizar una consulta real `SELECT 1`. No existe almacenamiento alternativo en memoria.

En fases posteriores, guardar aquí los scripts SQL versionados. Separar las consultas de las rutas y usar `execute(sql, valores)` con parámetros; nunca concatenar entradas del usuario. Las fechas persistidas se manejarán en UTC y se presentarán en America/Lima.
