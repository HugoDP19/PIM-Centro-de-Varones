import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createDatabasePool } from '../src/database.js';

export async function leerSentencias() {
  const sql = await readFile(new URL('schema.sql', import.meta.url), 'utf8');
  const sentencias = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    sentencias.some((s) => !/^(SET |CREATE TABLE |CREATE (?:UNIQUE )?INDEX |ALTER TABLE )/.test(s))
  ) {
    throw new Error('El esquema contiene una instrucción no permitida.');
  }
  return sentencias;
}

// Contrasta el esquema versionado con columnas, claves, índices y restricciones activas.
export async function verificarEsquema(db) {
  const sentencias = await leerSentencias();
  const tablas = sentencias.filter((s) => s.startsWith('CREATE TABLE'));
  const [columnas] = await db.execute(`
    SELECT t.name AS tabla,
      c.name AS columna
    FROM sys.tables t
      JOIN sys.columns c ON c.object_id = t.object_id
    ORDER BY t.name,
      c.column_id
  `);
  const [indices] = await db.execute(`
    SELECT t.name AS tabla,
      i.name AS nombre,
      c.name AS columna,
      i.is_primary_key AS pk,
      i.is_unique AS unico
    FROM sys.tables t
      JOIN sys.indexes i ON i.object_id = t.object_id
      JOIN sys.index_columns ic ON ic.object_id = i.object_id
      AND ic.index_id = i.index_id
      JOIN sys.columns c ON c.object_id = ic.object_id
      AND c.column_id = ic.column_id
    WHERE ic.key_ordinal > 0
    ORDER BY t.name,
      i.name,
      ic.key_ordinal
  `);
  const [fk] = await db.execute(`
    SELECT f.name AS nombre,
      t.name AS tabla,
      c.name AS columna,
      rt.name AS destino,
      rc.name AS referencia,
      f.is_disabled AS desactivada,
      f.is_not_trusted AS no_validada
    FROM sys.foreign_keys f
      JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = f.object_id
      JOIN sys.tables t ON t.object_id = f.parent_object_id
      JOIN sys.columns c ON c.object_id = t.object_id
      AND c.column_id = fc.parent_column_id
      JOIN sys.tables rt ON rt.object_id = f.referenced_object_id
      JOIN sys.columns rc ON rc.object_id = rt.object_id
      AND rc.column_id = fc.referenced_column_id
    ORDER BY f.name,
      fc.constraint_column_id
  `);
  const [checks] = await db.execute(
    `
      SELECT name AS nombre,
        is_disabled AS desactivada,
        is_not_trusted AS no_validada
      FROM sys.check_constraints
    `
  );
  assert.ok(
    [...fk, ...checks].every((r) => !r.desactivada && !r.no_validada),
    'Todas las restricciones deben estar activas y validadas.'
  );
  for (const texto of tablas) {
    const tabla = texto.match(/^CREATE TABLE (\w+)/)[1];
    const esperadas = [
      ...texto.matchAll(
        /^\s+(\w+) (?:BIGINT|NVARCHAR|VARCHAR|CHAR|TINYINT|INT|DATE|DATETIME2|DECIMAL)\b/gm
      )
    ].map((m) => m[1]);
    assert.deepEqual(
      columnas.filter((c) => c.tabla === tabla).map((c) => c.columna),
      esperadas,
      'Columnas de ' + tabla
    );
    const pk = texto
      .match(/PRIMARY KEY \(([^)]+)\)/)[1]
      .split(',')
      .map((c) => c.trim());
    assert.deepEqual(
      indices.filter((i) => i.tabla === tabla && i.pk).map((i) => i.columna),
      pk,
      'Clave primaria de ' + tabla
    );
    for (const m of texto.matchAll(/CONSTRAINT (\w+) UNIQUE \(([^)]+)\)/g)) {
      const actual = indices.filter((i) => i.tabla === tabla && i.nombre === m[1]);
      assert.deepEqual(
        actual.map((i) => i.columna),
        m[2].split(',').map((c) => c.trim())
      );
      assert.ok(actual.every((i) => i.unico));
    }
  }
  const completo = sentencias.join('\n');
  for (const m of completo.matchAll(
    /ALTER TABLE (\w+)\s+ADD CONSTRAINT (\w+)\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES (\w+)\s*\(([^)]+)\)/g
  )) {
    const actual = fk.filter((f) => f.nombre === m[2]);
    assert.deepEqual(
      actual.map((f) => f.columna),
      m[3].split(',').map((c) => c.trim()),
      m[2]
    );
    assert.deepEqual(
      actual.map((f) => f.referencia),
      m[5].split(',').map((c) => c.trim()),
      m[2]
    );
    assert.ok(actual.every((f) => f.tabla === m[1] && f.destino === m[4]));
  }
  for (const m of completo.matchAll(/CREATE (UNIQUE )?INDEX (\w+) ON (\w+) \(([^)]+)\)/g)) {
    const actual = indices.filter((i) => i.tabla === m[3] && i.nombre === m[2]);
    assert.deepEqual(
      actual.map((i) => i.columna),
      m[4].split(',').map((c) => c.trim()),
      m[2]
    );
    assert.ok(actual.every((i) => Boolean(i.unico) === Boolean(m[1])));
  }
  const esperados = [...completo.matchAll(/CONSTRAINT (\w+) CHECK/g)].map((m) => m[1]).sort();
  assert.deepEqual(checks.map((c) => c.nombre).sort(), esperados);
  return {
    tablas: tablas.length,
    columnas: columnas.length,
    clavesForaneas: new Set(fk.map((f) => f.nombre)).size,
    checks: checks.length
  };
}

export async function prepararBase(db) {
  const [[{ base, version }]] = await db.execute(
    `
      SELECT DB_NAME() AS base,
        CAST(SERVERPROPERTY('ProductMajorVersion') AS int) AS version
    `
  );
  if (process.env.NODE_ENV !== 'development' || base.toLowerCase() !== 'sice' || version < 16) {
    throw new Error('Se requiere SICE en desarrollo con SQL Server 2022 o superior.');
  }
  return { base, ...(await verificarEsquema(db)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createDatabasePool();
  try {
    console.log(JSON.stringify(await prepararBase(pool)));
  } catch (error) {
    console.error(
      error.code ? 'Verificación SQL Server detenida (' + error.code + ').' : error.message
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
