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
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

function tipoParametro(valor) {
  if (valor instanceof Date) {
    return sql.DateTime2(6);
  }
  if (typeof valor === 'boolean') {
    return sql.TinyInt;
  }
  if (typeof valor === 'number') {
    return Number.isInteger(valor) ? sql.BigInt : sql.Decimal(19, 4);
  }
  return sql.NVarChar(sql.MAX);
}

// Vincula valores tipados sin interpolarlos en el texto SQL.
async function ejecutar(destino, texto, valores = []) {
  const peticion = new sql.Request(destino);
  let indice = 0;
  const consulta = texto.replace(/'(?:''|[^'])*'|\?/g, (token) => {
    if (token !== '?') {
      return token;
    }
    const nombre = `p${indice}`;
    const valor = valores[indice++];
    peticion.input(nombre, tipoParametro(valor), valor ?? null);
    return `@${nombre}`;
  });
  if (indice !== valores.length) {
    throw new Error('Cantidad incorrecta de parámetros SQL.');
  }
  const resultado = await peticion.query(consulta);
  if (resultado.recordset) {
    return [resultado.recordset];
  }
  const filasAfectadas = resultado.rowsAffected.reduce((total, cantidad) => total + cantidad, 0);
  return [{ affectedRows: filasAfectadas }];
}

export function createDatabasePool(env = process.env) {
  const variablesObligatorias = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const variablesFaltantes = variablesObligatorias.filter((nombre) => !env[nombre]?.trim());
  if (variablesFaltantes.length) {
    throw new Error(`Faltan variables: ${variablesFaltantes.join(', ')}.`);
  }
  const puerto = Number(env.DB_PORT || 1433);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error('DB_PORT debe ser un entero entre 1 y 65535.');
  }
  const grupoConexiones = new sql.ConnectionPool({
    server: env.DB_HOST,
    port: puerto,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionTimeout: 10000,
    requestTimeout: 30000,
    pool: { max: 5, min: 0, idleTimeoutMillis: 10000 },
    options: {
      encrypt: env.DB_ENCRYPT !== 'false',
      trustServerCertificate: env.DB_TRUST_CERTIFICATE === 'true',
      useUTC: true
    }
  });
  let conexion;
  function conectar() {
    if (!conexion) {
      conexion = grupoConexiones.connect();
    }
    return conexion;
  }
  const execute = async (texto, valores) => ejecutar(await conectar(), texto, valores);
  return {
    execute,
    query: execute,
    async end() {
      if (conexion) {
        await conexion.catch(() => {});
        await grupoConexiones.close();
      }
    },
    async getConnection() {
      const pool = await conectar();
      let transaccionActual;
      const ejecutarLocal = (texto, valores) => ejecutar(transaccionActual || pool, texto, valores);
      return {
        execute: ejecutarLocal,
        query: ejecutarLocal,
        async beginTransaction() {
          transaccionActual = new sql.Transaction(pool);
          await transaccionActual.begin();
        },
        async commit() {
          await transaccionActual.commit();
          transaccionActual = undefined;
        },
        async rollback() {
          if (transaccionActual) {
            await transaccionActual.rollback();
            transaccionActual = undefined;
          }
        },
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
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
