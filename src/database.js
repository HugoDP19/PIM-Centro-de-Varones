import 'dotenv/config';
import mysql from 'mysql2/promise';
import { pathToFileURL } from 'node:url';

export function createDatabasePool(env = process.env) {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Faltan variables: ${missing.join(', ')}.`);
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT debe ser un entero entre 1 y 65535.');
  }
  return mysql.createPool({
    host: env.DB_HOST,
    port,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionLimit: 5,
    queueLimit: 20,
    connectTimeout: 10000,
    multipleStatements: false,
    charset: 'utf8mb4',
    timezone: 'Z'
  });
}

async function checkDatabase() {
  let pool;
  try {
    pool = createDatabasePool();
    await pool.execute('SELECT 1');
    console.log('Conexión MySQL verificada.');
  } catch (error) {
    // No imprimir detalles del controlador que puedan contener credenciales.
    console.error(error.code ? `No se pudo conectar a MySQL (${error.code}).` : error.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkDatabase();
}
