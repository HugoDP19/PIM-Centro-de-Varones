import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export async function leerSentencias(archivo) {
  const sql = await readFile(new URL(archivo, import.meta.url), 'utf8');
  return sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
}

export async function verificarEsquema(conexion) {
  const sentencias = await leerSentencias('schema.sql');
  const tablas = sentencias.filter((s) => s.startsWith('CREATE TABLE'));
  const [columnas] = await conexion.execute(`
    SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION`);
  const [restricciones] = await conexion.execute(`
    SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE, ENFORCED
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
      assert.ok(actual.every((i) => i.NON_UNIQUE === (m[1] ? 0 : 1)));
    }
  }
  const completo = sentencias.join('\n');
  for (const m of completo.matchAll(/CONSTRAINT (\w+)\s+(?:CHECK|FOREIGN KEY)/g)) {
    const actual = restricciones.find((c) => c.CONSTRAINT_NAME === m[1]);
    assert.ok(actual, `Restricción ${m[1]}`);
    if (actual.CONSTRAINT_TYPE === 'CHECK') assert.equal(actual.ENFORCED, 'YES');
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
    clavesForaneas: [...completo.matchAll(/FOREIGN KEY/g)].length, checks: [...completo.matchAll(/CONSTRAINT \w+ CHECK/g)].length };
}

export async function prepararBase(nombre) {
  if (process.env.NODE_ENV === 'production' || !['sice_desarrollo', 'sice_pruebas'].includes(nombre)) {
    throw new Error('La preparación solo permite sice_desarrollo o sice_pruebas fuera de producción.');
  }
  for (const clave of ['DB_USER', 'DB_PASSWORD']) {
    if (!process.env[clave]?.trim()) throw new Error(`Falta ${clave} en .env.`);
  }
  const conexion = await mysql.createConnection({ host: '127.0.0.1', port: 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, timezone: 'Z', multipleStatements: false });
  try {
    const [[{ version }]] = await conexion.execute('SELECT VERSION() AS version');
    if (!/^8\./.test(version)) throw new Error('Se requiere MySQL 8.');
    const [existentes] = await conexion.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [nombre]);
    const nueva = existentes.length === 0;
    if (nueva) await conexion.query(`CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await conexion.changeUser({ database: nombre });
    if (nueva) {
      for (const archivo of ['schema.sql', 'autenticacion.sql']) {
        for (const sentencia of await leerSentencias(archivo)) await conexion.query(sentencia);
      }
    }
    // Nunca reejecutar DDL sobre una base existente, ni reparar parcialmente a ciegas.
    const resultado = await verificarEsquema(conexion);
    await conexion.execute('SELECT token_hash FROM sesiones LIMIT 0');
    await conexion.execute('SELECT clave FROM intentos_acceso LIMIT 0');
    return { base: nombre, nueva, version, ...resultado, tablasTecnicas: 2 };
  } finally { await conexion.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await prepararBase(process.argv[2] || 'sice_desarrollo'))); }
  catch (error) {
    console.error(error.code ? `Preparación detenida (${error.code}); no se borraron datos.` : error.message);
    process.exitCode = 1;
  }
}
