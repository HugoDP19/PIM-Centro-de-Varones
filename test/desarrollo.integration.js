import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createDatabasePool } from '../src/database.js';
import { createApp } from '../src/app.js';
import { verificarEsquema, leerSentencias, concederGestionCuentas } from '../database/preparar.js';
import { personalEscolar, cargarColeccion, completarColeccion } from '../database/cargar-escolar.js';
import { detalleIncidencia, buscarIncidencia, auditar } from '../src/consultas-incidencias.js';
import { generarInforme } from '../src/informes.js';
import { cargarPermisos } from '../src/consultas-auth.js';
import { verificarGestionCuentas } from './cuentas.integration.js';

async function leerEstadoOrigen(conexion) {
  const [tablas] = await conexion.query('SHOW TABLES');
  const estado = {};
  for (const fila of tablas) {
    const tabla = Object.values(fila)[0];
    const [indices] = await conexion.query(`SHOW KEYS FROM \`${tabla}\` WHERE Key_name = 'PRIMARY'`);
    const orden = indices.sort((a, b) => a.Seq_in_index - b.Seq_in_index).map(indice => `\`${indice.Column_name}\``).join(', ');
    const [filas] = await conexion.query(`SELECT * FROM \`${tabla}\` ORDER BY ${orden}`);
    const [[estructura]] = await conexion.query(`SHOW CREATE TABLE \`${tabla}\``);
    // Solo se comparan cantidades y huellas; nunca se muestran datos ni credenciales.
    estado[tabla] = { cantidad: filas.length,
      huella: createHash('sha256').update(JSON.stringify([estructura, filas])).digest('hex') };
  }
  assert.ok([24, 26].includes(estado.incidencias?.cantidad), 'SICE conserva la colección original o su ampliación autorizada a 26.');
  return estado;
}

async function crearCopiaTemporal(claves) {
  const nombre = `sice_test_${randomBytes(8).toString('hex')}`;
  const opciones = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, dateStrings: true,
    supportBigNumbers: true, bigNumberStrings: true };
  const origen = await mysql.createConnection({ ...opciones, database: process.env.DB_NAME });
  const copia = await mysql.createConnection(opciones);
  let creada = false;
  const [[identidadInicial]] = await copia.query('SELECT CONNECTION_ID() AS conexion, @@server_uuid AS servidor');

  async function eliminarCopia() {
    try {
      if (!creada) return;
      const [[identidad]] = await copia.query('SELECT DATABASE() AS base, CONNECTION_ID() AS conexion, @@server_uuid AS servidor');
      // Exige creación propia, nombre exacto y la misma conexión al mismo servidor.
      if (!/^sice_test_[a-f0-9]{16}$/.test(nombre) || identidad.base !== nombre
          || identidad.conexion !== identidadInicial.conexion || identidad.servidor !== identidadInicial.servidor) {
        throw new Error('No coincide la identidad de la copia temporal; no se elimina ninguna base.');
      }
      await copia.query(`DROP DATABASE \`${nombre}\``);
      creada = false;
    } finally { await copia.end(); }
  }

  try {
    await origen.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const estadoInicial = await leerEstadoOrigen(origen);
    await copia.query(`CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    creada = true;
    await copia.changeUser({ database: nombre });
    const orden = [];
    for (const archivo of ['schema.sql', 'autenticacion.sql', 'gestion-cuentas.sql', 'solicitudes-cuentas.sql']) {
      for (const sentencia of await leerSentencias(archivo)) {
        await copia.query(sentencia);
        const tabla = sentencia.match(/^CREATE TABLE (\w+)/)?.[1];
        if (tabla) orden.push(tabla);
      }
    }
    // La instalación y la carga se comprueban sobre tablas vacías y se revierten.
    await copia.beginTransaction();
    assert.deepEqual(await cargarColeccion(copia, claves), { cargadas: 24, existentes: 0 });
    assert.deepEqual(await cargarColeccion(copia, claves), { cargadas: 0, existentes: 24 });
    const anteriores = {};
    for (const tabla of orden) anteriores[tabla] = (await copia.query(`SELECT * FROM \`${tabla}\``))[0];
    const ampliacion = await completarColeccion(copia);
    assert.equal(ampliacion.cargadas, 2); assert.equal(ampliacion.total, 26);
    assert.equal(new Set(ampliacion.codigos).size, 2);
    assert.equal((await completarColeccion(copia)).cargadas, 0);
    for (const tabla of orden) {
      const [filas] = await copia.query(`SELECT * FROM \`${tabla}\``);
      const conservadas = new Set(filas.map(fila => JSON.stringify(fila)));
      assert.ok(anteriores[tabla].every(fila => conservadas.has(JSON.stringify(fila))), `Ampliación conserva filas originales de ${tabla}`);
    }
    await copia.rollback();
    const originales = {};
    await copia.beginTransaction();
    for (const tabla of orden) {
      // Sesiones y límites pertenecen a la instancia activa, no a los expedientes.
      if (['sesiones', 'intentos_acceso'].includes(tabla)) continue;
      const [filas] = await origen.query(`SELECT * FROM \`${tabla}\``);
      originales[tabla] = filas;
      for (const fila of filas) {
        let datos = fila;
        if (tabla === 'incidencias') datos = { ...fila, estado: 'borrador', confirmada_en: null, id_version_vigente: null };
        if (tabla === 'solicitudes_cambio') datos = { ...fila, estado: 'pendiente', id_revision_resolutiva: null,
          id_decisor: null, id_rol_decisor: null, fundamento_decision: null, decidida_en: null };
        const columnas = Object.keys(datos);
        await copia.execute(`INSERT INTO \`${tabla}\` (${columnas.map(c => `\`${c}\``).join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`, Object.values(datos));
      }
    }
    // Se cierran los ciclos conservando FK y CHECK activos durante toda la copia.
    for (const tabla of ['incidencias', 'solicitudes_cambio']) {
      for (const fila of originales[tabla]) {
        const columnas = Object.keys(fila).filter(c => c !== 'id');
        await copia.execute(`UPDATE \`${tabla}\` SET ${columnas.map(c => `\`${c}\` = ?`).join(', ')} WHERE id = ?`, [...columnas.map(c => fila[c]), fila.id]);
      }
    }
    await concederGestionCuentas(copia);
    await copia.execute("UPDATE usuarios u JOIN personas p ON p.id = u.id_persona SET u.activo = 1 WHERE p.codigo_interno LIKE 'PER-2026-00%'");
    await copia.commit();
    await origen.rollback();
    async function verificarOrigen() {
      const conexion = await mysql.createConnection({ ...opciones, database: process.env.DB_NAME });
      try {
        await conexion.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        assert.deepEqual(await leerEstadoOrigen(conexion), estadoInicial, 'Las tablas, relaciones y datos de SICE deben permanecer intactos.');
        await conexion.rollback();
      } finally { await conexion.end(); }
    }
    return { nombre, eliminar: eliminarCopia, verificarOrigen };
  } catch (error) {
    await copia.rollback();
    await eliminarCopia();
    throw error;
  } finally { await origen.end(); }
}

test('Desarrollo real: cuentas, seis formularios, confidencialidad, seguimiento y PDF', { timeout: 120000 }, async (t) => {
  assert.equal(process.env.DB_NAME, 'SICE');
  assert.equal(process.env.NODE_ENV, 'development');
  const claves = dotenv.parse(await readFile(new URL('../.env.escolar.local', import.meta.url)));
  const copia = await crearCopiaTemporal(claves);
  let server, pool;
  t.after(async () => {
    try {
      if (server) await new Promise(resolve => server.close(resolve));
      if (pool) await pool.end();
    } finally {
      try { await copia.eliminar(); }
      finally { await copia.verificarOrigen(); }
    }
  });
  pool = createDatabasePool({ ...process.env, DB_NAME: copia.nombre });
  const [filas] = await pool.execute(`SELECT u.*, p.nombres, p.apellidos, r.codigo AS rol FROM usuarios u
    JOIN personas p ON p.id = u.id_persona JOIN roles r ON r.id = u.id_rol WHERE p.codigo_interno LIKE 'PER-2026-00%'`);
  const usuarios = Object.fromEntries(filas.map((u) => [u.rol, u]));
  const [escenarios] = await pool.execute("SELECT id_incidencia AS id, valor_nuevo AS numero FROM historial WHERE accion = 'carga_escolar'");
  const ids = Object.fromEntries(escenarios.map((e) => [e.numero, e.id]));
  const [personas] = await pool.execute("SELECT p.id, p.codigo_interno, m.id AS matricula FROM personas p LEFT JOIN matriculas m ON m.id_estudiante = p.id WHERE p.codigo_interno LIKE 'EST-2026-%'");
  const alumnos = Object.fromEntries(personas.map((p) => [Number(p.codigo_interno.slice(-3)), p]));
  let origin = 'http://127.0.0.1:3000';
  server = createApp({ pool, origin }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const peticion = (ruta, rol, method = 'GET', body, headers = {}) => fetch(`${base}/api/${ruta}`, {
    method, headers: { ...(cookies[rol] ? { Cookie: cookies[rol] } : {}), ...(method !== 'GET' ? { 'Content-Type': 'application/json', Origin: origin, 'X-SICE-Request': '1' } : {}), ...headers },
    body: method !== 'GET' ? JSON.stringify(body || {}) : undefined
  });
  const cookies = {};
  for (const [rol, _nombre, _apellido, nombreUsuario] of personalEscolar) {
    const response = await peticion('auth/login', null, 'POST', { usuario: nombreUsuario, contrasena: claves[`${rol.toUpperCase()}_PASSWORD`] });
    assert.equal(response.status, 200, `Login ${rol}`);
    cookies[rol] = response.headers.get('set-cookie').split(';')[0];
  }
  const datos = async (ruta, rol, method = 'GET', body, esperado = 200) => {
    const response = await peticion(ruta, rol, method, body);
    assert.equal(response.status, esperado, `${method} ${ruta}`);
    return response.json();
  };
  const categoriaDatos = {
    convivencia: { ambito_convivencia: 'presencial', requiere_mediacion: true },
    disciplina: { gravedad_disciplinaria: 'por_evaluar' },
    salud: { sintomas_observados: 'El estudiante refirió mareo y solicitó interrumpir la actividad; se dispuso acompañamiento.', requiere_atencion_inmediata: true },
    seguridad: { riesgo_identificado: 'Se observó agua junto al lavadero; se aisló la zona antes de permitir el paso.', riesgo_persistente: false },
    bienes: { descripcion_dano: 'Cuaderno no localizado al finalizar la actividad; se inició una búsqueda sin señalar responsables.' },
    proteccion_estudiantil: { riesgo_inmediato: false, requiere_derivacion: true }
  };
  const catalogo = await datos('incidencias/catalogos', 'director');
  function cuerpo(categoria) {
    const tipo = catalogo.tipos.find((t) => t.categoria === categoria && (categoria !== 'seguridad' || Number(t.minimo_estudiantes) === 0));
    const cantidad = categoria === 'seguridad' ? 0 : categoria === 'convivencia' ? 3 : 1;
    return { id_tipo: tipo.id, titulo: { convivencia: 'Intercambio de comentarios durante una actividad grupal', disciplina: 'Salida del aula durante el trabajo individual', salud: 'Malestar comunicado durante la jornada', seguridad: 'Superficie húmeda detectada cerca del lavadero', bienes: 'Cuaderno no localizado al terminar la clase', proteccion_estudiantil: 'Necesidad de apoyo comunicada a la autoridad' }[categoria],
      descripcion: 'Durante la jornada escolar, la docente comunicó los hechos observados y recibió información adicional del estudiante. Se registró la secuencia conocida, diferenciando las observaciones directas de lo referido por otras personas. Se dispuso una atención inicial y queda pendiente contrastar los aspectos no verificados, sin atribuir responsabilidad ni formular diagnósticos.',
      id_reportante: usuarios.docente.id_persona, condicion_reportante: 'personal', prioridad: 'normal', confidencialidad: 'interna', contenido_sensible: false,
      lugar: 'Ambiente de primaria', ocurrida_en: '2026-10-30T10:00:00-05:00',
      involucrados: Array.from({ length: cantidad }, (_, indice) => ({ id_persona: alumnos[indice + 1].id, id_matricula: alumnos[indice + 1].matricula, participacion: indice ? 'testigo' : 'afectado' })), ...categoriaDatos[categoria] };
  }

  await t.test('ubicaciones escolares y aulas: guardado y conservación de lugares históricos', async () => {
    const [antes] = await pool.execute('SELECT id, lugar FROM versiones_incidencia ORDER BY id');
    assert.ok(catalogo.aulas.length > 0);
    const aula = catalogo.aulas[0];
    for (const lugar of ['Patio de primaria', `Aula de ${aula.grado}.º de ${aula.nivel} ${aula.seccion}`, 'Zona de reunión temporal junto a portería']) {
      const nuevo = await datos('incidencias', 'director', 'POST', { ...cuerpo('seguridad'), lugar }, 201);
      assert.equal((await datos(`incidencias/${nuevo.id}`, 'director')).version.lugar, lugar);
    }
    const [despues] = await pool.execute('SELECT id, lugar FROM versiones_incidencia WHERE id <= ? ORDER BY id', [antes.at(-1).id]);
    assert.deepEqual(despues, antes);
  });

  await t.test('login inválido, rotación de sesión y cabeceras seguras', async () => {
    const invalida = await peticion('auth/login', null, 'POST', { usuario: 'lramos', contrasena: randomBytes(20).toString('hex') });
    const inexistente = await peticion('auth/login', null, 'POST', { usuario: 'cuenta.inexistente', contrasena: randomBytes(20).toString('hex') });
    assert.equal(invalida.status, 401); assert.equal(inexistente.status, 401);
    assert.deepEqual(await invalida.json(), await inexistente.json());
    const antigua = cookies.director;
    const nueva = await peticion('auth/login', 'director', 'POST', { usuario: 'rsalazar', contrasena: claves.DIRECTOR_PASSWORD });
    assert.equal(nueva.status, 200); assert.match(nueva.headers.get('set-cookie'), /HttpOnly/); assert.match(nueva.headers.get('set-cookie'), /SameSite=Strict/);
    const vieja = await fetch(`${base}/api/auth/sesion`, { headers: { Cookie: antigua } }); assert.equal(vieja.status, 401);
    cookies.director = nueva.headers.get('set-cookie').split(';')[0];
    const sesion = await peticion('auth/sesion', 'director'); assert.equal(sesion.status, 200); assert.equal(sesion.headers.get('cache-control'), 'no-store');
  });

  await t.test('cambio consecutivo de usuario: revocación en MySQL, cookie y CSRF', async () => {
    const secuencia = ['administrador', 'director', 'subdirector', 'administrador', 'coordinador_tutoria', 'docente', 'auxiliar'];
    for (const rol of secuencia) {
      const acceso = await peticion('auth/login', null, 'POST', { usuario: usuarios[rol].nombre_usuario, contrasena: claves[`${rol.toUpperCase()}_PASSWORD`] });
      assert.equal(acceso.status, 200, `Acceso consecutivo: ${rol}`);
      const cookie = acceso.headers.get('set-cookie').split(';')[0];
      const token = cookie.slice(cookie.indexOf('=') + 1);
      const sesion = await peticion('auth/sesion', null, 'GET', undefined, { Cookie: cookie });
      assert.equal((await sesion.json()).usuario.rol, rol);
      const [[antes]] = await pool.execute('SELECT COUNT(*) AS cantidad FROM sesiones WHERE token_hash = SHA2(?, 256)', [token]);
      assert.equal(Number(antes.cantidad), 1);
      const cierre = await peticion('auth/logout', null, 'POST', {}, { Cookie: cookie });
      assert.equal(cierre.status, 204);
      const borrado = cierre.headers.get('set-cookie');
      assert.ok(/^sice_session=;/.test(borrado), 'Logout debe vaciar la cookie');
      assert.ok(/Path=\//.test(borrado));
      assert.ok(/HttpOnly/.test(borrado));
      assert.ok(/SameSite=Strict/.test(borrado));
      assert.ok(new Date(borrado.match(/Expires=([^;]+)/)[1]).getTime() < Date.now());
      assert.ok(!/Domain=/i.test(borrado));
      const [[despues]] = await pool.execute('SELECT COUNT(*) AS cantidad FROM sesiones WHERE token_hash = SHA2(?, 256)', [token]);
      assert.equal(Number(despues.cantidad), 0);
      assert.equal((await peticion('auth/sesion', null, 'GET', undefined, { Cookie: cookie })).status, 401);
      assert.equal((await peticion('auth/sesion', null)).status, 401);
    }
    const origenDistinto = await peticion('auth/login', null, 'POST', { usuario: usuarios.director.nombre_usuario, contrasena: claves.DIRECTOR_PASSWORD }, { Origin: 'http://localhost:3000' });
    assert.equal(origenDistinto.status, 403);
    assert.equal((await origenDistinto.json()).error, 'Origen de la solicitud no autorizado.');
  });

  await t.test('caducidad absoluta e inactividad invalidan la sesión en el servidor', async () => {
    for (const columna of ['vence_en', 'ultima_actividad_en']) {
      await pool.execute(`UPDATE sesiones SET ${columna} = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 9 HOUR) WHERE id_usuario = ?`, [usuarios.director.id]);
      assert.equal((await peticion('auth/sesion', 'director')).status, 401);
      assert.equal((await peticion('incidencias', 'director')).status, 401);
      const acceso = await peticion('auth/login', null, 'POST', { usuario: usuarios.director.nombre_usuario, contrasena: claves.DIRECTOR_PASSWORD });
      assert.equal(acceso.status, 200);
      cookies.director = acceso.headers.get('set-cookie').split(';')[0];
    }
  });

  await t.test('MySQL 8 y esquema validado; scripts sin cambios inesperados de base', async () => {
    const [[fila]] = await pool.execute('SELECT VERSION() AS version'); assert.equal(fila.version, '8.0.46');
    assert.deepEqual(await verificarEsquema(pool), { tablas: 19, columnas: 187, clavesForaneas: 64, checks: 41 });
    for (const archivo of ['schema.sql', 'autenticacion.sql', 'gestion-cuentas.sql', 'solicitudes-cuentas.sql']) assert.ok((await leerSentencias(archivo)).every((s) => /^(CREATE TABLE|ALTER TABLE)\s/.test(s)));
  });
  await t.test('colección de 24 expedientes, adulto sin matrícula y carga repetible', async () => {
    assert.equal(escenarios.length, 24);
    assert.equal(new Set(escenarios.map(escenario => escenario.numero)).size, 24);
    const registro = await datos(`incidencias/${ids[19]}`, 'subdirector');
    assert.ok(registro.involucrados.some((p) => !p.es_estudiante && p.id_matricula === null));
    assert.ok(!/fictici|demo-|demostración|caso ficticio|estudiante \d/i.test(JSON.stringify([registro.version, registro.involucrados, registro.actuaciones])));
    assert.equal(registro.incidencia.confidencialidad, 'restringida');
  });
  await t.test('seis roles: ámbito propio/interno/restringido, conflicto y catálogos protegidos', async () => {
    assert.equal((await peticion('incidencias', null)).status, 401);
    for (const rol of ['director', 'subdirector']) assert.equal((await peticion(`incidencias/${ids[16]}`, rol)).status, 200);
    for (const rol of ['docente', 'auxiliar', 'coordinador_tutoria']) {
      assert.equal((await peticion(`incidencias/${ids[16]}`, rol)).status, 404);
      assert.equal((await peticion(`incidencias/${ids[19]}/pdf`, rol)).status, 404);
      const lista = await datos('incidencias', rol); assert.ok(lista.incidencias.every((i) => i.confidencialidad === 'interna'));
    }
    assert.equal((await peticion(`incidencias/${ids[18]}`, 'docente')).status, 404);
    assert.equal((await peticion(`incidencias/${ids[18]}`, 'auxiliar')).status, 200);
    assert.equal((await peticion(`incidencias/${ids[18]}`, 'coordinador_tutoria')).status, 200);
    assert.equal((await peticion(`incidencias/${ids[24]}`, 'director')).status, 404);
    for (const ruta of ['incidencias', 'incidencias/catalogos', `incidencias/${ids[1]}`, `incidencias/${ids[1]}/pdf`]) assert.equal((await peticion(ruta, 'administrador')).status, 403);
    const limitados = await datos('incidencias/catalogos', 'auxiliar');
    const [[testigo]] = await pool.execute("SELECT id FROM personas WHERE codigo_interno = 'EXT-2026-001'");
    assert.ok(!limitados.personas.some((p) => String(p.id) === String(testigo.id)));
    const lectura = await datos(`incidencias/${ids[18]}`, 'auxiliar'); assert.notEqual(lectura.version.id_reportante, usuarios.auxiliar.id_persona);
  });
  let editable;
  await t.test('borrador editable, autoría automática, validación y CSRF', async () => {
    const [[previo]] = await pool.execute("SELECT id_incidencia AS id FROM historial WHERE accion = 'verificacion_borrador' LIMIT 1");
    const payload = cuerpo('seguridad');
    if (previo) editable = previo.id;
    else {
      editable = (await datos('incidencias', 'director', 'POST', payload, 201)).id;
      await auditar(pool, usuarios.director, editable, 'verificacion_borrador');
    }
    await datos(`incidencias/${editable}/borrador`, 'director', 'PUT', { ...payload, titulo: 'Revisión previa de la ubicación de un riesgo' });
    const detalle = await datos(`incidencias/${editable}`, 'director');
    assert.equal(detalle.incidencia.id_registrador, usuarios.director.id);
    assert.notEqual(detalle.version.id_reportante, detalle.incidencia.id_registrador);
    assert.ok(detalle.historial.some((h) => h.accion === 'borrador_editado'));
    assert.equal((await peticion('incidencias', 'director', 'POST', { ...payload, id_registrador: usuarios.auxiliar.id })).status, 400);
    assert.equal((await peticion('incidencias', 'director', 'POST', cuerpo('salud'), { Origin: 'https://otro.example' })).status, 403);
    assert.equal((await peticion('incidencias', 'director', 'POST', { ...cuerpo('salud'), gravedad_disciplinaria: 'grave' })).status, 400);
    const incorrecto = cuerpo('disciplina'); incorrecto.involucrados[0].id_matricula = alumnos[2].matricula;
    assert.equal((await peticion('incidencias', 'director', 'POST', incorrecto)).status, 400);
    assert.equal((await peticion(`incidencias/${editable}/pdf`, 'director')).status, 409);
  });
  const registrados = {};
  await t.test('registro y confirmación de las seis categorías, con cero/uno/varios estudiantes', async () => {
    for (const categoria of Object.keys(categoriaDatos)) {
      const [[previo]] = await pool.execute("SELECT id_incidencia AS id FROM historial WHERE accion = 'verificacion_categoria' AND valor_nuevo = ? LIMIT 1", [categoria]);
      let id = previo?.id;
      if (!id) {
        id = (await datos('incidencias', 'director', 'POST', cuerpo(categoria), 201)).id;
        const respuestas = await Promise.all([peticion(`incidencias/${id}/confirmar`, 'director', 'POST', {}), peticion(`incidencias/${id}/confirmar`, 'director', 'POST', {})]);
        assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 409]);
        await auditar(pool, usuarios.director, id, 'verificacion_categoria', { campo: 'categoria', valor_nuevo: categoria });
      }
      registrados[categoria] = id;
      const detalle = await datos(`incidencias/${id}`, 'director');
      assert.equal(detalle.version.categoria, categoria); assert.equal(detalle.incidencia.estado, 'confirmada');
      if (['salud', 'proteccion_estudiantil'].includes(categoria)) assert.equal(detalle.incidencia.confidencialidad, 'restringida');
      if (categoria !== 'disciplina') assert.equal(detalle.version.gravedad_disciplinaria, null);
    }
    const incompleto = { ...cuerpo('seguridad'), riesgo_persistente: null };
    await datos(`incidencias/${editable}/borrador`, 'director', 'PUT', incompleto);
    assert.equal((await peticion(`incidencias/${editable}/confirmar`, 'director', 'POST', {})).status, 400);
    await datos(`incidencias/${editable}/borrador`, 'director', 'PUT', { ...cuerpo('disciplina'), involucrados: [] });
    assert.equal((await peticion(`incidencias/${editable}/confirmar`, 'director', 'POST', {})).status, 400);
    await datos(`incidencias/${editable}/borrador`, 'director', 'PUT', cuerpo('seguridad'));
  });
  await t.test('hechos confirmados inmutables ante escritura; sin eliminación física', async () => {
    const id = registrados.seguridad;
    const [antes] = await pool.execute('SELECT * FROM versiones_incidencia WHERE id_incidencia = ?', [id]);
    const [[historia]] = await pool.execute('SELECT COUNT(*) AS cantidad FROM historial WHERE id_incidencia = ?', [id]);
    assert.equal((await peticion(`incidencias/${id}/borrador`, 'director', 'PUT', cuerpo('seguridad'))).status, 409);
    assert.equal((await peticion(`incidencias/${id}`, 'director', 'DELETE', {})).status, 405);
    assert.equal((await peticion(`incidencias/${id}`, 'administrador', 'PATCH', { descripcion: 'Cambio no autorizado' })).status, 403);
    const [despues] = await pool.execute('SELECT * FROM versiones_incidencia WHERE id_incidencia = ?', [id]); assert.deepEqual(despues, antes);
    const [[historiaDespues]] = await pool.execute('SELECT COUNT(*) AS cantidad FROM historial WHERE id_incidencia = ?', [id]); assert.equal(historiaDespues.cantidad, historia.cantidad);
  });
  await t.test('seguimiento por adición y corrección enlazada, con historial y estado', async () => {
    const id = ids[6];
    const anterior = await datos(`incidencias/${id}`, 'docente');
    const nuevo = await datos(`incidencias/${id}/actuaciones`, 'docente', 'POST', { tipo: 'actuacion', detalle: 'Se conversó con el estudiante sobre el procedimiento para comunicar una necesidad durante la clase. Se acordó revisar su aplicación en la siguiente jornada.', id_responsable: usuarios.docente.id, contenido_sensible: false }, 201);
    await datos(`incidencias/${id}/actuaciones`, 'docente', 'POST', { tipo: 'observacion', detalle: 'Se precisa que la conversación se realizó al finalizar la actividad, manteniéndose íntegro el registro anterior.', id_responsable: usuarios.docente.id, id_actuacion_corregida: nuevo.id, contenido_sensible: false }, 201);
    const despues = await datos(`incidencias/${id}`, 'docente');
    assert.equal(despues.incidencia.estado, 'en_seguimiento'); assert.equal(despues.actuaciones.length, anterior.actuaciones.length + 2);
    assert.equal(despues.version.descripcion, anterior.version.descripcion);
    assert.ok(despues.historial.some((h) => h.accion === 'seguimiento_agregado'));
    assert.equal((await peticion(`incidencias/${ids[22]}/actuaciones`, 'auxiliar', 'POST', { tipo: 'actuacion', detalle: 'No debe admitirse.' })).status, 409);
  });
  await t.test('seguimiento sensible eleva protección atómicamente y devuelve constancia sin contenido', async () => {
    let [[registro]] = await pool.execute("SELECT i.id, i.confidencialidad FROM incidencias i JOIN historial h ON h.id_incidencia = i.id WHERE h.accion = 'verificacion_reserva' LIMIT 1");
    if (!registro) {
      const payload = { ...cuerpo('seguridad'), id_reportante: usuarios.auxiliar.id_persona, titulo: 'Seguimiento reservado de una observación en el acceso' };
      const creado = await datos('incidencias', 'auxiliar', 'POST', payload, 201);
      await datos(`incidencias/${creado.id}/confirmar`, 'auxiliar', 'POST', {});
      await auditar(pool, usuarios.auxiliar, creado.id, 'verificacion_reserva');
      const respuesta = await datos(`incidencias/${creado.id}/actuaciones`, 'auxiliar', 'POST', {
        tipo: 'observacion', detalle: 'Se recibió información adicional de carácter reservado y se remitió a la autoridad habilitada para su evaluación, sin difundirla al grupo.',
        id_responsable: usuarios.subdirector.id, contenido_sensible: true
      }, 201);
      assert.equal(respuesta.acceso, false); assert.deepEqual(Object.keys(respuesta).sort(), ['acceso', 'id']);
      registro = { id: creado.id };
    }
    assert.equal((await peticion(`incidencias/${registro.id}`, 'auxiliar')).status, 404);
    const protegido = await datos(`incidencias/${registro.id}`, 'subdirector');
    assert.equal(protegido.incidencia.confidencialidad, 'restringida');
    assert.ok(protegido.historial.some((h) => h.accion === 'confidencialidad_elevada'));
  });
  await t.test('FK y CHECK rechazan datos inválidos con rollback, sin afectar otras bases', async () => {
    const db = await pool.getConnection(); await db.beginTransaction();
    try {
      await assert.rejects(db.execute('UPDATE incidencias SET id_version_vigente = ? WHERE id = ?', [1, ids[19]]), { code: 'ER_NO_REFERENCED_ROW_2' });
      await assert.rejects(db.execute("UPDATE incidencias SET prioridad = 'invalida' WHERE id = ?", [ids[19]]), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
      const [[testigo]] = await db.execute("SELECT id FROM personas WHERE codigo_interno = 'EXT-2026-001'");
      await assert.rejects(db.execute('UPDATE involucrados SET id_matricula = ? WHERE id_persona = ?', [alumnos[1].matricula, testigo.id]), { code: 'ER_NO_REFERENCED_ROW_2' });
    } finally { await db.rollback(); db.release(); }
  });
  await t.test('paginación MySQL: 25 filas, orden estable, búsquedas y totales autorizados', async () => {
    const roles = ['director', 'subdirector', 'coordinador_tutoria', 'docente', 'auxiliar'];
    const iniciales = {};
    for (const rol of roles) iniciales[rol] = (await datos('incidencias', rol)).paginacion.total;
    const nuevos = [];
    for (let numero = 1; numero <= 31; numero++) {
      const nuevo = await datos('incidencias', 'director', 'POST', { ...cuerpo('seguridad'),
        titulo: `Paginación institucional ${String(numero).padStart(3, '0')}`, contenido_sensible: numero > 28 }, 201);
      await datos(`incidencias/${nuevo.id}/confirmar`, 'director', 'POST', {});
      nuevos.push(String(nuevo.id));
      await pool.execute("UPDATE incidencias SET registrada_en = '2026-11-17 18:00:00' WHERE id = ?", [nuevo.id]);
    }
    for (const rol of roles) {
      const cantidad = ['director', 'subdirector'].includes(rol) ? 31 : rol === 'coordinador_tutoria' ? 28 : 0;
      assert.equal((await datos('incidencias', rol)).paginacion.total, iniciales[rol] + cantidad);
      const primera = await datos('incidencias?buscar=Paginaci%C3%B3n%20institucional&pagina=1', rol);
      assert.equal(primera.paginacion.total, cantidad);
      assert.equal(primera.incidencias.length, Math.min(25, cantidad));
      const ultima = await datos('incidencias?buscar=Paginaci%C3%B3n%20institucional&pagina=999', rol);
      assert.equal(ultima.paginacion.pagina, cantidad ? 2 : 1);
      if (cantidad) {
        assert.equal(ultima.incidencias.length, cantidad - 25);
        const esperados = nuevos.slice(0, cantidad).reverse();
        assert.deepEqual([...primera.incidencias, ...ultima.incidencias].map(fila => String(fila.id)), esperados);
        assert.deepEqual([ultima.paginacion.desde, ultima.paginacion.hasta], [26, cantidad]);
      } else assert.deepEqual([primera.paginacion.desde, primera.paginacion.hasta], [0, 0]);
    }
    assert.equal((await peticion('incidencias?pagina=2', 'administrador')).status, 403);
    for (const pagina of ['0', '-1', '2.5', 'abc', '100000000', '1&pagina=2']) {
      assert.equal((await peticion(`incidencias?pagina=${pagina}`, 'director')).status, 400);
    }
    const vacia = await datos('incidencias?buscar=sin-coincidencias-verificadas&pagina=2', 'director');
    assert.deepEqual(vacia.paginacion, { pagina: 1, paginas: 1, porPagina: 25, total: 0, desde: 0, hasta: 0 });
  });
  await verificarGestionCuentas({ t, pool, peticion, datos, usuarios, claves, cookies });
  await t.test('PDF A4, siete secciones, registrador histórico y firma/sello sin cortes', async () => {
    const response = await peticion(`incidencias/${ids[18]}/pdf`, 'subdirector'); assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/pdf/);
    const buffer = Buffer.from(await response.arrayBuffer());
    const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    const textos = [], paginasFirma = [], paginasSello = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n), content = await page.getTextContent();
      assert.ok(Math.abs(page.view[2] - 595.28) < 1 && Math.abs(page.view[3] - 841.89) < 1);
      const texto = content.items.map((i) => i.str).join(' '); textos.push(texto);
      assert.ok(texto.includes(`Página ${n} de ${pdf.numPages}`));
      for (const item of content.items.filter((i) => i.str.includes('Firma del registrador') || i.str.includes('Sello del Director'))) assert.ok(item.transform[5] > 50);
      if (texto.includes('Firma del registrador')) paginasFirma.push(n);
      if (texto.includes('Sello del Director')) paginasSello.push(n);
    }
    const texto = textos.join(' ');
    assert.ok(texto.includes('INFORME DE INCIDENCIA ESCOLAR'));
    assert.ok(texto.includes('Carlos Enrique Torres Castillo')); assert.ok(texto.includes('Auxiliar'));
    assert.ok(texto.includes('Lucía Patricia Ramos Vega'));
    assert.deepEqual(paginasFirma, paginasSello); assert.equal(paginasFirma.length, 1);
    assert.ok(textos.at(-1).includes('SEGUIMIENTO Y ESTADO') || textos.at(-1).length > 800, 'Las firmas deben compartir página con contenido sustancial del informe.');
    const autor = await cargarPermisos(pool, usuarios.subdirector);
    const incidencia = await buscarIncidencia(pool, autor, ids[18]);
    const largo = await detalleIncidencia(pool, incidencia);
    largo.version.descripcion = Array.from({ length: 90 }, () => largo.version.descripcion).join('\n');
    largo.actuaciones.push({ tipo: 'observacion', detalle: largo.version.descripcion, realizada_en: new Date(), autor: largo.incidencia.nombre_registrador, cargo_autor: largo.incidencia.cargo_registrador });
    const extendido = await generarInforme(largo);
    const pdfLargo = await getDocument({ data: new Uint8Array(extendido), useSystemFonts: true }).promise; assert.ok(pdfLargo.numPages > 5);
    const ultimo = (await (await pdfLargo.getPage(pdfLargo.numPages)).getTextContent()).items.map((i) => i.str).join(' ');
    assert.ok(ultimo.includes('Firma del registrador') && ultimo.includes('Sello del Director'));
    assert.ok(ultimo.length > 700, 'La última página del informe extenso debe conservar texto junto a las firmas.');
    await pdf.cleanup?.(); await pdfLargo.cleanup?.();
  });
  await t.test('PDF desde MySQL: actuaciones y observaciones extensas completas, sin filas fuera de página', async () => {
    const nuevo = await datos('incidencias', 'subdirector', 'POST', cuerpo('seguridad'), 201);
    await datos(`incidencias/${nuevo.id}/confirmar`, 'subdirector', 'POST', {});
    const marcadores = [];
    for (const tipo of ['actuacion', 'observacion']) {
      const detalle = Array.from({ length: 60 }, (_, i) => {
        const marca = `${tipo.toUpperCase()}-${String(i).padStart(3, '0')}`; marcadores.push(marca);
        return `${marca}: Se registró el acompañamiento y la verificación del ambiente escolar, conservando la descripción completa para su seguimiento.`;
      }).join('\n');
      await datos(`incidencias/${nuevo.id}/actuaciones`, 'subdirector', 'POST', { tipo, detalle,
        id_responsable: usuarios.subdirector.id, fecha_limite: '2026-12-18', contenido_sensible: false }, 201);
    }
    const response = await peticion(`incidencias/${nuevo.id}/pdf`, 'subdirector');
    assert.equal(response.status, 200);
    const pdf = await getDocument({ data: new Uint8Array(await response.arrayBuffer()), useSystemFonts: true }).promise;
    const textos = [];
    for (let pagina = 1; pagina <= pdf.numPages; pagina++) {
      const contenido = await (await pdf.getPage(pagina)).getTextContent();
      const texto = contenido.items.map(item => item.str).join(' '); textos.push(texto);
      assert.ok(texto.length > 400, `Página ${pagina}: evitar hojas vacías o solo con encabezado`);
      for (const item of contenido.items.filter(item => item.str.trim())) {
        const margenInferior = item.str.includes('Página ') ? 25 : 60;
        assert.ok(item.transform[5] >= margenInferior && item.transform[5] <= 810, `Texto dentro de márgenes en página ${pagina}`);
        assert.ok(item.transform[4] >= 47 && item.transform[4] + item.width <= 549, `Texto dentro del ancho en página ${pagina}`);
      }
    }
    const texto = textos.join(' ');
    for (const marca of marcadores) assert.equal(texto.split(marca).length - 1, 1, `Conservar una vez ${marca}`);
    assert.match(texto, /Continuación del registro/);
    assert.match(texto, /Plazo: 18\/12\/26/);
    assert.ok(textos.at(-1).includes('Firma del registrador') && textos.at(-1).includes('Sello del Director'));
    await pdf.cleanup?.();
  });
  await t.test('PDF distingue al responsable del seguimiento sin repetir al autor dentro del bloque', async () => {
    const nuevo = await datos('incidencias', 'subdirector', 'POST', cuerpo('seguridad'), 201);
    await datos(`incidencias/${nuevo.id}/confirmar`, 'subdirector', 'POST', {});
    const autor = `${usuarios.subdirector.nombres} ${usuarios.subdirector.apellidos}`;
    const responsable = `${usuarios.director.nombres} ${usuarios.director.apellidos}`;
    for (const [indice, idResponsable] of [usuarios.subdirector.id, usuarios.director.id].entries()) {
      await datos(`incidencias/${nuevo.id}/actuaciones`, 'subdirector', 'POST', { tipo: 'actuacion',
        detalle: 'Se verificó el ambiente escolar y se coordinó el acompañamiento para el seguimiento.',
        id_responsable: idResponsable, fecha_limite: '2026-12-18', contenido_sensible: false }, 201);
      const respuesta = await peticion(`incidencias/${nuevo.id}/pdf`, 'subdirector');
      assert.equal(respuesta.status, 200);
      const pdf = await getDocument({ data: new Uint8Array(await respuesta.arrayBuffer()), useSystemFonts: true }).promise;
      let texto = '';
      for (let pagina = 1; pagina <= pdf.numPages; pagina++) texto += (await (await pdf.getPage(pagina)).getTextContent()).items.map(item => item.str).join(' ') + ' ';
      const bloque = texto.split('5. ACTUACIONES REALIZADAS')[1].split('6. SEGUIMIENTO Y ESTADO')[0];
      assert.equal(bloque.split(autor).length - 1, indice + 1);
      assert.match(bloque, /A cargo de quien registra/);
      if (indice) assert.ok(bloque.includes(`Responsable del seguimiento: ${responsable}`));
      await pdf.cleanup?.();
    }
  });
  await t.test('logout revoca las sesiones de los seis roles', async () => {
    for (const [rol] of personalEscolar) { assert.equal((await peticion('auth/logout', rol, 'POST', {})).status, 204); assert.equal((await peticion('auth/sesion', rol)).status, 401); }
  });
  await t.test('las políticas provisionales no se habilitan en producción', async () => {
    const servidor = createApp({ pool, origin: 'https://sice.example', produccion: true, proxyLocal: true }).listen(0, '127.0.0.1');
    await once(servidor, 'listening');
    try {
      const acceso = await fetch(`http://127.0.0.1:${servidor.address().port}/api/auth/login`, { method: 'POST', headers: {
        'Content-Type': 'application/json', Origin: 'https://sice.example', 'X-SICE-Request': '1', 'X-Forwarded-Proto': 'https'
      }, body: JSON.stringify({ usuario: 'rsalazar', contrasena: claves.DIRECTOR_PASSWORD }) });
      assert.equal(acceso.status, 200); assert.match(acceso.headers.get('set-cookie'), /; Secure/);
      const cookie = acceso.headers.get('set-cookie').split(';')[0];
      for (const ruta of ['incidencias', 'cuentas/catalogos']) assert.equal((await fetch(`http://127.0.0.1:${servidor.address().port}/api/${ruta}`, { headers: { Cookie: cookie, 'X-Forwarded-Proto': 'https' } })).status, 503);
    } finally { await new Promise((resolve) => servidor.close(resolve)); }
  });
  if (process.env.TEST_BROWSER === '1') {
    await t.test('interfaz de escritorio y adaptación básica, sin guardar archivos', async () => {
      await new Promise(resolve => server.close(resolve));
      const direccion = new URL(base);
      origin = direccion.origin;
      server = createApp({ pool, origin }).listen(Number(direccion.port), '127.0.0.1');
      await once(server, 'listening');
      const { verificarInterfaz } = await import('./interfaz-browser.js');
      await verificarInterfaz(base, claves, async (nombreUsuario) => {
        // Solo modifica sesiones de la copia temporal creada por esta suite.
        await pool.execute(`UPDATE sesiones s JOIN usuarios u ON u.id = s.id_usuario
          SET s.vence_en = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 SECOND) WHERE u.nombre_usuario = ?`, [nombreUsuario]);
      });
    });
  }
});
