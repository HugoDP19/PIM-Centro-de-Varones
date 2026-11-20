import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createDatabasePool } from '../src/database.js';

const tablasTecnicas = ['sesiones', 'intentos_acceso', 'autorizaciones_cuentas'];

// Lee el esquema y admite únicamente DDL de tablas; no permite instrucciones para cambiar de base.
export async function leerSentencias() {
  const sql = await readFile(new URL('schema.sql', import.meta.url), 'utf8');
  const sentencias = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (sentencias.some((s) => !/^(CREATE TABLE|ALTER TABLE)\s/.test(s))) {
    throw new Error('El esquema solo puede contener CREATE TABLE y ALTER TABLE.');
  }
  return sentencias;
}

// Contrasta columnas, claves e índices con los metadatos y exige FK y CHECK habilitados.
export async function verificarEsquema(conexion, soloEscolares = false) {
  const [[opciones]] = await conexion.execute('SELECT @@check_constraint_checks AS checks, @@foreign_key_checks AS claves');
  assert.equal(Number(opciones.checks), 1, 'Los CHECK deben estar activos.');
  assert.equal(Number(opciones.claves), 1, 'Las claves foráneas deben estar activas.');
  const sentencias = (await leerSentencias()).filter((s) => !soloEscolares || !tablasTecnicas.some((tabla) => s.startsWith(`CREATE TABLE ${tabla} (`)));
  const tablas = sentencias.filter((s) => s.startsWith('CREATE TABLE'));
  const [columnas] = await conexion.execute(`
    SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION`);
  const [restricciones] = await conexion.execute(`
    SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
    FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE()`);
  const [indices] = await conexion.execute(`
    SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`);
  const [relaciones] = await conexion.execute(`
    SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME,
           REFERENCED_COLUMN_NAME, ORDINAL_POSITION
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION`);
  for (const sql of tablas) {
    const tabla = sql.match(/^CREATE TABLE (\w+)/)[1];
    const esperadas = [...sql.matchAll(/^\s+(\w+) (?:BIGINT|VARCHAR|CHAR|BOOLEAN|DATE|DATETIME|TEXT|INT|SMALLINT|TINYINT|DECIMAL)\b/gm)].map((m) => m[1]);
    assert.deepEqual(columnas.filter((c) => c.TABLE_NAME === tabla).map((c) => c.COLUMN_NAME), esperadas, `Columnas de ${tabla}`);
    const pk = sql.match(/PRIMARY KEY \(([^)]+)\)/)[1].split(',').map((s) => s.trim());
    assert.deepEqual(indices.filter((i) => i.TABLE_NAME === tabla && i.INDEX_NAME === 'PRIMARY').map((i) => i.COLUMN_NAME), pk, `PK de ${tabla}`);
    for (const m of sql.matchAll(/(UNIQUE )?KEY (\w+) \(([^)]+)\)/g)) {
      const actual = indices.filter((i) => i.TABLE_NAME === tabla && i.INDEX_NAME === m[2]);
      assert.deepEqual(actual.map((i) => i.COLUMN_NAME), m[3].split(',').map((s) => s.trim()), `Índice ${m[2]}`);
      assert.ok(actual.every((i) => Number(i.NON_UNIQUE) === (m[1] ? 0 : 1)));
    }
  }
  const completo = sentencias.join('\n');
  for (const m of completo.matchAll(/CONSTRAINT (\w+)\s+(?:CHECK|FOREIGN KEY)/g)) {
    const actual = restricciones.find((c) => c.CONSTRAINT_NAME === m[1]);
    assert.ok(actual, `Restricción ${m[1]}`);
    assert.equal(actual.CONSTRAINT_TYPE, /CONSTRAINT \w+\s+CHECK/.test(m[0]) ? 'CHECK' : 'FOREIGN KEY');
  }
  for (const m of completo.matchAll(/CONSTRAINT (\w+)\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES (\w+)\s*\(([^)]+)\)/g)) {
    const actual = relaciones.filter((r) => r.CONSTRAINT_NAME === m[1]);
    assert.deepEqual(actual.map((r) => r.COLUMN_NAME), m[2].split(',').map((s) => s.trim()));
    assert.ok(actual.every((r) => r.REFERENCED_TABLE_NAME === m[3]));
    assert.deepEqual(actual.map((r) => r.REFERENCED_COLUMN_NAME), m[4].split(',').map((s) => s.trim()));
    const tabla = actual[0].TABLE_NAME;
    const nombres = [...new Set(indices.filter((i) => i.TABLE_NAME === tabla).map((i) => i.INDEX_NAME))];
    assert.ok(nombres.some((nombre) => {
      const cols = indices.filter((i) => i.TABLE_NAME === tabla && i.INDEX_NAME === nombre);
      return actual.every((r, index) => cols[index]?.COLUMN_NAME === r.COLUMN_NAME);
    }), `Índice de soporte ${m[1]}`);
  }
  return { tablas: tablas.length, columnas: columnas.filter((c) => tablas.some((s) => s.startsWith(`CREATE TABLE ${c.TABLE_NAME} (`))).length,
    clavesForaneas: [...completo.matchAll(/FOREIGN KEY/g)].length,
    checks: new Set([...completo.matchAll(/CONSTRAINT (\w+) CHECK/g)].map((m) => m[1])).size };
}

// Valida primero el modelo escolar y crea solo las tablas técnicas que todavía no existen.
export async function prepararBase(conexion) {
  const [[{ base, version }]] = await conexion.query('SELECT DATABASE() AS base, VERSION() AS version');
  if (process.env.NODE_ENV !== 'development' || process.env.DB_HOST !== '127.0.0.1'
      || !['sice', 'sice_local'].includes(base?.toLowerCase())) {
    throw new Error('La preparación solo permite SICE o sice_local en desarrollo local.');
  }
  if (!/MariaDB/i.test(version)) throw new Error('Se requiere MariaDB.');
  await verificarEsquema(conexion, true);
  const [tablas] = await conexion.query('SHOW TABLES');
  const existentes = new Set(tablas.map((fila) => Object.values(fila)[0]));
  const pendientes = (await leerSentencias()).filter((sql) => tablasTecnicas.some((tabla) =>
    sql.startsWith(`CREATE TABLE ${tabla} (`) && !existentes.has(tabla)));
  // MariaDB valida sintaxis y privilegios sin ejecutar el DDL.
  for (const sql of pendientes) {
    await conexion.query('PREPARE sice_tabla FROM ?', [sql]);
    await conexion.query('DEALLOCATE PREPARE sice_tabla');
  }
  for (const sql of pendientes) await conexion.query(sql);
  return { base, creadas: pendientes.map((sql) => sql.match(/^CREATE TABLE (\w+)/)[1]),
    ...await verificarEsquema(conexion) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createDatabasePool();
  let conexion;
  try {
    if (process.argv.length > 2) throw new Error('db:prepare no acepta opciones; solo completa las tablas técnicas faltantes.');
    conexion = await pool.getConnection();
    console.log(JSON.stringify(await prepararBase(conexion)));
  } catch (error) {
    console.error(error.code ? `Preparación detenida (${error.code}); revisar esquema y permisos CREATE.` : error.message);
    process.exitCode = 1;
  } finally { if (conexion) conexion.release(); await pool.end(); }
}
