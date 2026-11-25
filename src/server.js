import { createApp } from './app.js';
import { createDatabasePool } from './database.js';

// Valida la dirección del servicio antes de intentar abrir el puerto.
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un entero entre 1 y 65535.');
}
const produccion = process.env.NODE_ENV === 'production';
const origin = process.env.APP_ORIGIN || `http://${host}:${port}`;
let pool;
try {
  const url = new URL(origin);
  if (url.origin !== origin || (produccion && url.protocol !== 'https:')) {
    throw new Error('APP_ORIGIN debe ser un origen válido; producción requiere HTTPS.');
  }
  // Comprueba la conexión y las columnas técnicas necesarias antes de aceptar peticiones.
  pool = createDatabasePool();
  await pool.execute('SELECT 1');
  await pool.execute('SELECT TOP (0) token_hash FROM sesiones');
  await pool.execute('SELECT TOP (0) clave FROM intentos_acceso');
  await pool.execute('SELECT TOP (0) id_persona FROM involucrados');
  await pool.execute('SELECT TOP (0) id, id_solicitante, estado FROM autorizaciones_cuentas');
  // Solo datos técnicos caducados. Nunca se eliminan incidencias ni historial.
  await pool.execute('DELETE FROM sesiones WHERE vence_en <= SYSUTCDATETIME()');
  await pool.execute('DELETE FROM intentos_acceso WHERE vence_en <= SYSUTCDATETIME()');
  // Inicia HTTP solo después de validar la base y gestiona los errores de escucha.
  const app = createApp({ pool, origin, produccion, proxyLocal: process.env.TRUST_PROXY_LOCAL === '1' });
  const server = app.listen(port, host);
  server.once('listening', () => console.log(`SICE-Local disponible en ${origin}`));
  server.on('error', async (error) => {
    console.error(`No se pudo iniciar el servidor (${error.code || 'ERROR'}).`);
    await pool.end();
    process.exitCode = 1;
  });
  // Al detener el proceso, termina la escucha y cierra las conexiones de SQL Server.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(async () => { await pool.end(); }));
  }
} catch (error) {
  console.error(error.code ? `No se pudo iniciar SICE-Local: comprueba la base de datos y el esquema (${error.code}).` : error.message);
  if (pool) await pool.end();
  process.exitCode = 1;
}
