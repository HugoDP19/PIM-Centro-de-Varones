import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createDatabasePool } from '../src/database.js';
import { leerSentencias, verificarEsquema } from './preparar.js';

export async function actualizarDesarrollo() {
  if (process.env.NODE_ENV !== 'development' || process.env.DB_NAME !== 'sice_desarrollo' || process.env.DB_HOST !== '127.0.0.1') {
    throw new Error('La actualización solo permite sice_desarrollo local en modo development.');
  }
  const pool = createDatabasePool();
  const db = await pool.getConnection();
  try {
    const [[bloqueo]] = await db.execute("SELECT GET_LOCK('sice_actualizar_desarrollo', 0) AS adquirido");
    if (!bloqueo.adquirido) throw new Error('Otra actualización está en curso.');
    const [[{ cantidad }]] = await db.execute('SELECT COUNT(*) AS cantidad FROM involucrados');
    const [columnas] = await db.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'involucrados'");
    if (columnas.some((c) => c.COLUMN_NAME === 'id_estudiante')) {
      // Un único ALTER atómico en MySQL 8: conserva las personas y matrículas ya relacionadas.
      await db.query(`ALTER TABLE involucrados
        DROP FOREIGN KEY fk_involucrados_estudiante,
        DROP FOREIGN KEY fk_involucrados_matricula,
        CHANGE COLUMN id_estudiante id_persona BIGINT UNSIGNED NOT NULL,
        RENAME INDEX ix_involucrados_estudiante_version TO ix_involucrados_persona_version,
        ADD CONSTRAINT fk_involucrados_persona FOREIGN KEY (id_persona) REFERENCES personas (id),
        ADD CONSTRAINT fk_involucrados_persona_matricula FOREIGN KEY (id_persona, id_matricula) REFERENCES matriculas (id_estudiante, id)`);
    }
    const [[despues]] = await db.execute('SELECT COUNT(*) AS cantidad FROM involucrados');
    if (Number(despues.cantidad) !== Number(cantidad)) throw new Error('La cantidad de relaciones cambió inesperadamente.');
    const [tablas] = await db.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'autorizaciones_cuentas'");
    if (!tablas.length) for (const sql of await leerSentencias('gestion-cuentas.sql')) await db.query(sql);
    return { base: 'sice_desarrollo', relacionesConservadas: Number(cantidad), ...await verificarEsquema(db), tablasTecnicas: 3 };
  } finally {
    await db.execute("SELECT RELEASE_LOCK('sice_actualizar_desarrollo')");
    db.release(); await pool.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await actualizarDesarrollo())); }
  catch (error) { console.error(error.code ? `Actualización detenida (${error.code}).` : error.message); process.exitCode = 1; }
}
