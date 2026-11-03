import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import { createDatabasePool } from '../src/database.js';
import { createApp } from '../src/app.js';
import { resumir, roles, verificarHash } from '../src/seguridad.js';
import { prepararBase, verificarEsquema } from '../database/preparar.js';
import { cargarDatosDemo } from '../database/cargar-demo.js';

async function prepararDatos(pool) {
  const archivo = new URL('../.env.pruebas.local', import.meta.url);
  let claves;
  try { claves = dotenv.parse(await readFile(archivo)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    claves = Object.fromEntries(roles.map((rol) => [rol, randomBytes(24).toString('base64url')]));
    await writeFile(archivo, Object.entries(claves).map(([clave, valor]) => `${clave}=${valor}`).join('\n'), { flag: 'wx', mode: 0o600 });
  }
  const db = await pool.getConnection();
  try {
    const [[{ cantidad }]] = await db.execute('SELECT COUNT(*) AS cantidad FROM personas');
    if (!Number(cantidad)) {
      const [tablas] = await db.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
      for (const { TABLE_NAME } of tablas) {
        const [[fila]] = await db.query(`SELECT COUNT(*) AS cantidad FROM \`${TABLE_NAME.replaceAll('`', '``')}\``);
        assert.equal(Number(fila.cantidad), 0, 'Se requieren tablas vacías para preparar las pruebas.');
      }
      await db.beginTransaction();
      try { await cargarDatosDemo(db, claves); await db.commit(); }
      catch (error) { await db.rollback(); throw error; }
    }
    const [usuarios] = await db.execute('SELECT u.*, r.codigo AS rol FROM usuarios u JOIN roles r ON r.id = u.id_rol ORDER BY u.id');
    assert.equal(usuarios.length, 6, 'La base de pruebas debe contener solo las seis cuentas sintéticas.');
    for (const usuario of usuarios) {
      assert.equal(usuario.nombre_usuario, `demo.${usuario.rol}`);
      assert.ok(await verificarHash(claves[usuario.rol], usuario.contrasena_hash), 'Credencial sintética no coincide con el archivo local de pruebas.');
    }
    return { claves, usuarios };
  } finally { db.release(); }
}

test('MySQL real: esquema, integridad, demostración y autenticación', { timeout: 120000 }, async (t) => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  await prepararBase('sice_pruebas');
  const pool = createDatabasePool({ ...process.env, DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_NAME: 'sice_pruebas' });
  t.after(() => pool.end());
  const { claves, usuarios } = await prepararDatos(pool);

  await t.test('metadatos de las 19 tablas: PK, 64 FK, índices y 41 CHECK', async () => {
    assert.deepEqual(await verificarEsquema(pool), { tablas: 19, columnas: 187, clavesForaneas: 64, checks: 41 });
  });

  await t.test('23 casos persistidos, seis categorías, estados, identidades y versiones', async () => {
    const [filas] = await pool.execute(`
      SELECT i.id, i.estado, i.confidencialidad, u.id_persona AS registrador_persona,
             v.id_reportante, v.titulo, v.descripcion, v.gravedad_disciplinaria, t.categoria,
             (SELECT COUNT(*) FROM involucrados inv WHERE inv.id_version = v.id) AS estudiantes
      FROM incidencias i JOIN versiones_incidencia v ON v.id = i.id_version_vigente
      JOIN tipos_incidencia t ON t.id = v.id_tipo JOIN usuarios u ON u.id = i.id_registrador`);
    assert.equal(filas.length, 23);
    assert.equal(new Set(filas.map((f) => f.categoria)).size, 6);
    for (const cantidad of [0, 1, 3]) assert.ok(filas.some((f) => Number(f.estudiantes) === cantidad));
    for (const estado of ['confirmada', 'en_seguimiento', 'cerrada', 'anulada']) assert.ok(filas.some((f) => f.estado === estado));
    for (const fila of filas) {
      assert.ok(fila.descripcion.length > 200);
      if (fila.categoria !== 'disciplina') assert.equal(fila.gravedad_disciplinaria, null);
      if (['salud', 'proteccion_estudiantil'].includes(fila.categoria)) assert.equal(fila.confidencialidad, 'restringida');
    }
    const auxiliar = filas.find((f) => f.titulo.startsWith('[DEMO-18]'));
    assert.notEqual(auxiliar.registrador_persona, auxiliar.id_reportante);
    const [solicitudes] = await pool.execute(`
      SELECT s.*, i.id_version_vigente FROM solicitudes_cambio s JOIN incidencias i ON i.id = s.id_incidencia`);
    assert.equal(solicitudes.length, 5);
    for (const solicitud of solicitudes.filter((s) => s.id_decisor)) assert.notEqual(solicitud.id_decisor, solicitud.id_solicitante);
    const aprobada = solicitudes.find((s) => s.tipo === 'rectificacion' && s.estado === 'aprobada');
    const rechazada = solicitudes.find((s) => s.estado === 'rechazada');
    assert.equal(aprobada.id_version_vigente, aprobada.id_version_propuesta);
    assert.equal(rechazada.id_version_vigente, rechazada.id_version_base);
    const [[{ cantidad }]] = await pool.execute('SELECT COUNT(*) AS cantidad FROM versiones_incidencia');
    assert.equal(Number(cantidad), 27);
    const [[revision]] = await pool.execute('SELECT * FROM revisiones');
    assert.equal(revision.estado, 'concluida');
    assert.ok(revision.acta.length > 100);
    const [[participantes]] = await pool.execute('SELECT COUNT(*) AS cantidad FROM participantes_revision WHERE id_revision = ?', [revision.id]);
    assert.equal(Number(participantes.cantidad), 4);
    const [[conflicto]] = await pool.execute('SELECT estado, id_resolutor FROM conflictos_interes');
    assert.equal(conflicto.estado, 'inhibido');
    assert.equal(conflicto.id_resolutor, null);
  });

  await t.test('41 casos inválidos rechazados por CHECK dentro de una transacción revertida', async () => {
    const db = await pool.getConnection();
    await db.beginTransaction();
    try {
      const pruebas = [
        ['personas_documento', 'personas', "pais_documento = 'PE'"],
        ['personas_booleanos', 'personas', 'es_personal = 2'],
        ['roles_codigo', 'roles', "codigo = 'inexistente'"],
        ['usuarios_activo', 'usuarios', 'activo = 2'],
        ['estudiantes_activo', 'estudiantes', 'activo = 2'],
        ['apoderados_personas', 'estudiantes_apoderados', 'id_apoderado = id_estudiante'],
        ['apoderados_principal', 'estudiantes_apoderados', 'es_principal = 2'],
        ['apoderados_periodo', 'estudiantes_apoderados', "vigente_hasta = '2020-01-01'"],
        ['aulas_activo', 'aulas', 'activo = 2'],
        ['matriculas_periodo', 'matriculas', "fecha_fin = '2020-01-01'"],
        ['tipos_categoria', 'tipos_incidencia', "categoria = 'otra'"],
        ['tipos_activo', 'tipos_incidencia', 'activo = 2'],
        ['incidencias_estado', 'incidencias', "estado = 'otro'"],
        ['incidencias_prioridad', 'incidencias', "prioridad = 'otra'"],
        ['incidencias_confidencialidad', 'incidencias', "confidencialidad = 'publica'"],
        ['incidencias_confirmacion', 'incidencias', 'confirmada_en = NULL'],
        ['versiones_numero', 'versiones_incidencia', 'numero_version = 0'],
        ['versiones_estado', 'versiones_incidencia', "estado_version = 'otro'"],
        ['versiones_reportante', 'versiones_incidencia', "condicion_reportante = 'otra'"],
        ['versiones_gravedad', 'versiones_incidencia', "gravedad_disciplinaria = 'otra'"],
        ['versiones_ambito', 'versiones_incidencia', "ambito_convivencia = 'otro'"],
        ['versiones_booleanos', 'versiones_incidencia', 'requiere_mediacion = 2'],
        ['versiones_importe', 'versiones_incidencia', "monto_estimado = -1, moneda = 'PEN'"],
        ['involucrados_participacion', 'involucrados', "participacion = 'otra'"],
        ['actuaciones_tipo', 'actuaciones', "tipo = 'otro'"],
        ['solicitudes_tipo', 'solicitudes_cambio', "tipo = 'otro'"],
        ['solicitudes_estado', 'solicitudes_cambio', "estado = 'otro'"],
        ['solicitudes_confidencialidad', 'solicitudes_cambio', "confidencialidad_propuesta = 'publica'"],
        ['solicitudes_contenido', 'solicitudes_cambio', 'id_version_propuesta = id_version_base'],
        ['solicitudes_evaluacion', 'solicitudes_cambio', 'id_evaluador = id_solicitante'],
        ['solicitudes_decision', 'solicitudes_cambio', 'id_decisor = id_solicitante'],
        ['solicitudes_revision_aprobada', 'solicitudes_cambio', 'requiere_revision = 1'],
        ['revisiones_estado', 'revisiones', "estado = 'otro'"],
        ['revisiones_booleanos', 'revisiones', 'requiere_reunion = 2'],
        ['revisiones_reunion', 'revisiones', 'reunion_en = NULL'],
        ['revisiones_acta', 'revisiones', 'id_emisor_acta = NULL'],
        ['revisiones_cierre', 'revisiones', 'conclusion = NULL'],
        ['revisiones_periodo', 'revisiones', "cerrada_en = '2020-01-01'"],
        ['participantes_asistencia', 'participantes_revision', "asistencia = 'otra'"],
        ['conflictos_estado', 'conflictos_interes', "estado = 'otro'"],
        ['conflictos_resolucion', 'conflictos_interes', 'id_resolutor = id_usuario_afectado']
      ];
      assert.equal(pruebas.length, 41);
      for (const [nombre, tabla, cambio] of pruebas) {
        await db.query('SAVEPOINT caso_check');
        try {
          // Varias restricciones pueden rechazar la misma fila; su orden no es un contrato.
          await assert.rejects(db.query(`UPDATE ${tabla} SET ${cambio} LIMIT 1`), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' }, nombre);
        } finally { await db.query('ROLLBACK TO SAVEPOINT caso_check'); }
      }
    } finally { await db.rollback(); db.release(); }
  });

  await t.test('FK compuestas y unicidad rechazan referencias incompatibles; rollback', async () => {
    const db = await pool.getConnection();
    await db.beginTransaction();
    try {
      const [incidencias] = await db.execute('SELECT id, id_version_vigente FROM incidencias ORDER BY id LIMIT 2');
      await assert.rejects(db.execute('UPDATE incidencias SET id_version_vigente = ? WHERE id = ?', [incidencias[1].id_version_vigente, incidencias[0].id]), { code: 'ER_NO_REFERENCED_ROW_2' });
      await assert.rejects(db.execute('UPDATE versiones_incidencia SET id_autor = ? WHERE id = ?', ['18446744073709551614', incidencias[0].id_version_vigente]), { code: 'ER_NO_REFERENCED_ROW_2' });
      const [matriculas] = await db.execute('SELECT id, id_estudiante FROM matriculas ORDER BY id LIMIT 2');
      await assert.rejects(db.execute('UPDATE involucrados SET id_matricula = ? WHERE id_estudiante = ?', [matriculas[1].id, matriculas[0].id_estudiante]), { code: 'ER_NO_REFERENCED_ROW_2' });
      const [[solicitud]] = await db.execute('SELECT id FROM solicitudes_cambio LIMIT 1');
      await assert.rejects(db.execute('UPDATE solicitudes_cambio SET id_version_base = ? WHERE id = ?', [incidencias[0].id_version_vigente, solicitud.id]), { code: 'ER_NO_REFERENCED_ROW_2' });
      const [[persona]] = await db.execute('SELECT codigo_interno FROM personas LIMIT 1');
      await assert.rejects(db.execute('INSERT INTO personas (codigo_interno, nombres, apellidos, es_personal, activo) VALUES (?, ?, ?, ?, ?)', [persona.codigo_interno, 'Duplicado', 'Ficticio', 0, 1]), { code: 'ER_DUP_ENTRY' });
    } finally { await db.rollback(); db.release(); }
  });

  // Solo se limpian contadores técnicos del entorno de pruebas, nunca expedientes.
  await pool.execute('DELETE FROM intentos_acceso');
  const origin = 'http://127.0.0.1:3000';
  let server = createApp({ pool, origin }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  let base = `http://127.0.0.1:${server.address().port}`;
  const solicitud = (ruta, { method = 'GET', cookie, body, headers = {} } = {}) => fetch(`${base}${ruta}`, {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: origin, 'X-SICE-Request': '1' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const login = (rol, cookie) => solicitud('/api/auth/login', { method: 'POST', cookie, body: { usuario: `demo.${rol}`, contrasena: claves[rol] } });
  const obtenerCookie = (response) => response.headers.get('set-cookie')?.split(';')[0];

  await t.test('401, credenciales inválidas, validación y CSRF', async () => {
    assert.equal((await solicitud('/api/auth/sesion')).status, 401);
    assert.equal((await solicitud('/api/incidencias/1')).status, 401);
    const invalida = await solicitud('/api/auth/login', { method: 'POST', body: { usuario: 'demo.docente', contrasena: randomBytes(20).toString('hex') } });
    const inexistente = await solicitud('/api/auth/login', { method: 'POST', body: { usuario: 'cuenta.inexistente', contrasena: randomBytes(20).toString('hex') } });
    assert.equal(invalida.status, 401);
    assert.equal(inexistente.status, 401);
    assert.deepEqual(await invalida.json(), await inexistente.json());
    assert.equal((await solicitud('/api/auth/login', { method: 'POST', body: { usuario: "' OR 1=1 --", contrasena: 'x' } })).status, 400);
    assert.equal((await solicitud('/api/auth/login', { method: 'POST', body: {}, headers: { Origin: 'https://otro.example' } })).status, 403);
    assert.equal((await solicitud('/api/auth/login', { method: 'POST', body: {}, headers: { 'X-SICE-Request': '' } })).status, 403);
    const malformada = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformada.status, 400);
  });

  await t.test('inicio válido para seis roles, permisos efectivos y sesión sin secretos', async () => {
    for (const rol of roles) {
      const response = await login(rol);
      assert.equal(response.status, 200, rol);
      const setCookie = response.headers.get('set-cookie');
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Strict/);
      const { usuario } = await response.json();
      assert.equal(usuario.rol, rol);
      assert.deepEqual(Object.keys(usuario).sort(), ['id', 'nombre', 'nombre_usuario', 'permisos', 'rol']);
      assert.ok(usuario.permisos.includes('sesion.consultar'));
      assert.equal(usuario.permisos.includes('cuentas.administrar'), rol === 'administrador');
      const cookie = obtenerCookie(response);
      const sesion = await solicitud('/api/auth/sesion', { cookie });
      assert.equal(sesion.status, 200);
      assert.equal(sesion.headers.get('cache-control'), 'no-store');
      const token = cookie.split('=')[1];
      const [[fila]] = await pool.execute('SELECT token_hash FROM sesiones WHERE token_hash = ?', [resumir(token)]);
      assert.ok(fila && fila.token_hash !== token);
      assert.equal((await solicitud('/api/auth/logout', { method: 'POST', cookie, body: {} })).status, 204);
      assert.equal((await solicitud('/api/auth/sesion', { cookie })).status, 401);
    }
  });

  await t.test('sesión persiste tras reiniciar HTTP; rotación, falsificación y logout revocable', async () => {
    const primero = obtenerCookie(await login('docente'));
    await new Promise((resolve) => server.close(resolve));
    server = createApp({ pool, origin }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await solicitud('/api/auth/sesion', { cookie: primero })).status, 200);
    const segundo = obtenerCookie(await login('docente', primero));
    assert.ok(primero !== segundo);
    assert.equal((await solicitud('/api/auth/sesion', { cookie: primero })).status, 401);
    assert.equal((await solicitud('/api/auth/sesion', { cookie: `sice_session=${randomBytes(32).toString('hex')}` })).status, 401);
    assert.equal((await solicitud('/api/auth/logout', { method: 'POST', cookie: segundo, body: {}, headers: { Origin: 'https://otro.example' } })).status, 403);
    assert.equal((await solicitud('/api/auth/sesion', { cookie: segundo })).status, 200);
    assert.equal((await solicitud('/api/auth/logout', { method: 'POST', cookie: segundo, body: {} })).status, 204);
    assert.equal((await solicitud('/api/auth/sesion', { cookie: segundo })).status, 401);
  });

  await t.test('caducidad, inactividad, desactivación y cambio de contraseña invalidan acceso', async () => {
    for (const campo of ['vence_en', 'ultima_actividad_en']) {
      const cookie = obtenerCookie(await login('docente'));
      await pool.execute(`UPDATE sesiones SET ${campo} = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 DAY) WHERE token_hash = ?`, [resumir(cookie.split('=')[1])]);
      assert.equal((await solicitud('/api/auth/sesion', { cookie })).status, 401);
    }
    const docente = usuarios.find((u) => u.rol === 'docente');
    const cookie = obtenerCookie(await login('docente'));
    try {
      await pool.execute('UPDATE usuarios SET activo = 0 WHERE id = ?', [docente.id]);
      assert.equal((await solicitud('/api/auth/sesion', { cookie })).status, 401);
      assert.equal((await login('docente')).status, 401);
      await pool.execute('UPDATE usuarios SET activo = 1, contrasena_hash = ? WHERE id = ?', ['hash-invalido-de-prueba', docente.id]);
      assert.equal((await solicitud('/api/auth/sesion', { cookie })).status, 401);
    } finally { await pool.execute('UPDATE usuarios SET activo = 1, contrasena_hash = ? WHERE id = ?', [docente.contrasena_hash, docente.id]); }
    assert.equal((await solicitud('/api/auth/sesion', { cookie })).status, 401, 'Una sesión revocada no reaparece al reactivar la cuenta.');
  });

  await t.test('revocación de permisos aplicada en la siguiente petición (403)', async () => {
    const docente = usuarios.find((u) => u.rol === 'docente');
    const cookie = obtenerCookie(await login('docente'));
    const [[permiso]] = await pool.execute("SELECT id FROM permisos WHERE codigo = 'sesion.consultar'");
    try {
      await pool.execute('DELETE FROM roles_permisos WHERE id_rol = ? AND id_permiso = ?', [docente.id_rol, permiso.id]);
      assert.equal((await solicitud('/api/auth/sesion', { cookie })).status, 403);
    } finally { await pool.execute('INSERT INTO roles_permisos (id_rol, id_permiso) VALUES (?, ?)', [docente.id_rol, permiso.id]); }
    assert.equal((await solicitud('/api/auth/sesion', { cookie })).status, 200);
    await solicitud('/api/auth/logout', { method: 'POST', cookie, body: {} });
  });

  await t.test('caso 25: lectura reservada y modificación directa denegadas, historial intacto', async () => {
    const [[caso]] = await pool.execute("SELECT i.id, i.id_version_vigente FROM incidencias i JOIN versiones_incidencia v ON v.id = i.id_version_vigente WHERE v.titulo LIKE '[DEMO-16]%'");
    const [antes] = await pool.execute('SELECT * FROM versiones_incidencia WHERE id = ?', [caso.id_version_vigente]);
    const [historiaAntes] = await pool.execute('SELECT * FROM historial WHERE id_incidencia = ? ORDER BY id', [caso.id]);
    for (const rol of roles) {
      const cookie = obtenerCookie(await login(rol));
      for (const method of ['GET', 'PATCH', 'PUT', 'DELETE']) {
        const response = await solicitud(`/api/incidencias/${caso.id}`, { method, cookie, body: method === 'GET' ? undefined : { descripcion: 'Intento no autorizado' } });
        assert.equal(response.status, 403);
        assert.ok(!(await response.text()).includes(antes[0].descripcion));
      }
      await solicitud('/api/auth/logout', { method: 'POST', cookie, body: {} });
    }
    const [despues] = await pool.execute('SELECT * FROM versiones_incidencia WHERE id = ?', [caso.id_version_vigente]);
    const [historiaDespues] = await pool.execute('SELECT * FROM historial WHERE id_incidencia = ? ORDER BY id', [caso.id]);
    assert.deepEqual(despues, antes);
    assert.deepEqual(historiaDespues, historiaAntes);
  });

  await t.test('límite persistente de intentos de cuenta', async () => {
    const cuenta = `inexistente.${randomBytes(5).toString('hex')}`;
    for (let numero = 0; numero < 10; numero++) {
      assert.equal((await solicitud('/api/auth/login', { method: 'POST', body: { usuario: cuenta, contrasena: randomBytes(20).toString('hex') } })).status, 401);
    }
    const response = await solicitud('/api/auth/login', { method: 'POST', body: { usuario: cuenta, contrasena: 'otra-clave-ficticia' } });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '900');
  });

  await t.test('producción exige HTTPS y emite cookie Secure detrás de proxy local autorizado', async () => {
    const produccion = createApp({ pool, origin: 'https://sice.example', produccion: true, proxyLocal: true }).listen(0, '127.0.0.1');
    await once(produccion, 'listening');
    try {
      const url = `http://127.0.0.1:${produccion.address().port}/api/auth/login`;
      const headers = { 'Content-Type': 'application/json', Origin: 'https://sice.example', 'X-SICE-Request': '1' };
      const body = JSON.stringify({ usuario: 'demo.auxiliar', contrasena: claves.auxiliar });
      assert.equal((await fetch(url, { method: 'POST', headers, body })).status, 403);
      const response = await fetch(url, { method: 'POST', headers: { ...headers, 'X-Forwarded-Proto': 'https' }, body });
      assert.equal(response.status, 200);
      const cookie = response.headers.get('set-cookie');
      assert.ok(cookie.startsWith('__Host-sice_session='));
      assert.match(cookie, /; Secure/);
      assert.match(cookie, /; HttpOnly/);
      assert.match(cookie, /; SameSite=Strict/);
    } finally { await new Promise((resolve) => produccion.close(resolve)); }
  });

  await t.test('arranque falla explícitamente si falta la conexión configurada', () => {
    const resultado = spawnSync(process.execPath, ['src/server.js'], { env: { ...process.env, DB_PASSWORD: '' }, encoding: 'utf8', timeout: 10000 });
    assert.equal(resultado.status, 1);
    assert.match(resultado.stderr, /DB_PASSWORD/);
    assert.ok(!resultado.stdout.includes('disponible'));
  });
});
