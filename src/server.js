import 'dotenv/config';
import { createApp } from './app.js';
import { createDatabasePool } from './database.js';

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
  pool = createDatabasePool();
  await pool.execute('SELECT 1');
  await pool.execute('SELECT token_hash FROM sesiones LIMIT 0');
  await pool.execute('SELECT clave FROM intentos_acceso LIMIT 0');
  await pool.execute('SELECT id_persona FROM involucrados LIMIT 0');
  await pool.execute('SELECT id FROM autorizaciones_cuentas LIMIT 0');
  // Solo datos técnicos caducados. Nunca se eliminan incidencias ni historial.
  await pool.execute('DELETE FROM sesiones WHERE vence_en <= UTC_TIMESTAMP(6)');
  await pool.execute('DELETE FROM intentos_acceso WHERE vence_en <= UTC_TIMESTAMP(6)');
  const app = createApp({ pool, origin, produccion, proxyLocal: process.env.TRUST_PROXY_LOCAL === '1' });
  const server = app.listen(port, host, () => console.log(`SICE-Local disponible en ${origin}`));
  server.on('error', async (error) => {
    console.error(`No se pudo iniciar el servidor (${error.code || 'ERROR'}).`);
    await pool.end();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(async () => { await pool.end(); }));
  }
} catch (error) {
  console.error(error.code ? `No se pudo iniciar SICE-Local: comprueba MySQL y el esquema (${error.code}).` : error.message);
  if (pool) await pool.end();
  process.exitCode = 1;
}
