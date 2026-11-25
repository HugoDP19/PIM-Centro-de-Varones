import 'dotenv/config';
import sql from 'mssql';
import { pathToFileURL } from 'node:url';

if (!process.env.NODE_ENV && ['127.0.0.1', 'localhost'].includes(process.env.DB_HOST)) {
  process.env.NODE_ENV = 'development';
}

export async function transaccion(pool, operacion) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const resultado = await operacion(db);
    await db.commit();
    return resultado;
  } catch (error) { await db.rollback(); throw error; }
  finally { db.release(); }
}

// Vincula valores tipados sin interpolarlos en el texto SQL.
async function ejecutar(destino, texto, valores = []) {
  const request = new sql.Request(destino);
  let indice = 0;
  const consulta = texto.replace(/'(?:''|[^'])*'|\?/g, (token) => {
    if (token !== '?') return token;
    const nombre = `p${indice}`, valor = valores[indice++];
    const tipo = valor instanceof Date ? sql.DateTime2(6)
      : typeof valor === 'boolean' ? sql.TinyInt
        : typeof valor === 'number' ? (Number.isInteger(valor) ? sql.BigInt : sql.Decimal(19, 4))
          : sql.NVarChar(sql.MAX);
    request.input(nombre, tipo, valor ?? null);
    return `@${nombre}`;
  });
  if (indice !== valores.length) throw new Error('Cantidad incorrecta de parámetros SQL.');
  const resultado = await request.query(consulta);
  return [resultado.recordset || { affectedRows: resultado.rowsAffected.reduce((a, b) => a + b, 0) }];
}

export function createDatabasePool(env = process.env) {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Faltan variables: ${missing.join(', ')}.`);
  const port = Number(env.DB_PORT || 1433);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT debe ser un entero entre 1 y 65535.');
  const raw = new sql.ConnectionPool({
    server: env.DB_HOST, port, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
    connectionTimeout: 10000, requestTimeout: 30000, pool: { max: 5, min: 0, idleTimeoutMillis: 10000 },
    options: { encrypt: env.DB_ENCRYPT !== 'false', trustServerCertificate: env.DB_TRUST_CERTIFICATE === 'true', useUTC: true }
  });
  let conexion;
  const conectar = () => conexion ||= raw.connect();
  const execute = async (texto, valores) => ejecutar(await conectar(), texto, valores);
  return {
    execute, query: execute,
    async end() { if (conexion) { await conexion.catch(() => {}); await raw.close(); } },
    async getConnection() {
      const pool = await conectar();
      let transaction;
      const ejecutarLocal = (texto, valores) => ejecutar(transaction || pool, texto, valores);
      return {
        execute: ejecutarLocal, query: ejecutarLocal,
        async beginTransaction() { transaction = new sql.Transaction(pool); await transaction.begin(); },
        async commit() { await transaction.commit(); transaction = undefined; },
        async rollback() { if (transaction) { await transaction.rollback(); transaction = undefined; } },
        release() {}
      };
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool;
  try {
    pool = createDatabasePool();
    await pool.execute('SELECT 1 AS conexion');
    console.log('Conexión SQL Server verificada.');
  } catch (error) {
    console.error(error.code ? `No se pudo conectar a SQL Server (${error.code}).` : error.message);
    process.exitCode = 1;
  } finally { if (pool) await pool.end(); }
}
