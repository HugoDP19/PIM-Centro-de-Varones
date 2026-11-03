import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createDatabasePool } from '../src/database.js';
import { createApp } from '../src/app.js';
import { verificarEsquema, leerSentencias } from '../database/preparar.js';
import { cargarEscolar, personalEscolar } from '../database/cargar-escolar.js';
import { detalleIncidencia, buscarIncidencia, auditar } from '../src/consultas-incidencias.js';
import { generarInforme } from '../src/informes.js';
import { cargarPermisos } from '../src/consultas-auth.js';

test('Desarrollo real: cuentas, seis formularios, confidencialidad, seguimiento y PDF', { timeout: 120000 }, async (t) => {
  assert.equal(process.env.DB_NAME, 'sice_desarrollo');
  assert.equal(process.env.NODE_ENV, 'development');
  await cargarEscolar();
  const claves = dotenv.parse(await readFile(new URL('../.env.escolar.local', import.meta.url)));
  const pool = createDatabasePool();
  t.after(() => pool.end());
  const [filas] = await pool.execute(`SELECT u.*, p.nombres, p.apellidos, r.codigo AS rol FROM usuarios u
    JOIN personas p ON p.id = u.id_persona JOIN roles r ON r.id = u.id_rol WHERE p.codigo_interno LIKE 'PER-2026-00%'`);
  const usuarios = Object.fromEntries(filas.map((u) => [u.rol, u]));
  const [escenarios] = await pool.execute("SELECT id_incidencia AS id, valor_nuevo AS numero FROM historial WHERE accion = 'carga_escolar'");
  const ids = Object.fromEntries(escenarios.map((e) => [e.numero, e.id]));
  const [personas] = await pool.execute("SELECT p.id, p.codigo_interno, m.id AS matricula FROM personas p LEFT JOIN matriculas m ON m.id_estudiante = p.id WHERE p.codigo_interno LIKE 'EST-2026-%'");
  const alumnos = Object.fromEntries(personas.map((p) => [Number(p.codigo_interno.slice(-3)), p]));
  const origin = 'http://127.0.0.1:3000';
  const server = createApp({ pool, origin }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
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

  await t.test('MySQL 8 y esquema validado; scripts sin cambios inesperados de base', async () => {
    const [[fila]] = await pool.execute('SELECT VERSION() AS version'); assert.equal(fila.version, '8.0.46');
    assert.deepEqual(await verificarEsquema(pool), { tablas: 19, columnas: 187, clavesForaneas: 64, checks: 41 });
    for (const archivo of ['schema.sql', 'autenticacion.sql', 'gestion-cuentas.sql']) assert.ok((await leerSentencias(archivo)).every((s) => /^(CREATE TABLE|ALTER TABLE)\s/.test(s)));
  });
  await t.test('colección de 24 expedientes, adulto sin matrícula y carga repetible', async () => {
    assert.equal(escenarios.length, 24);
    assert.deepEqual(await cargarEscolar(), { cargadas: 0, existentes: 24 });
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
  await t.test('cuentas: autorización independiente, ejecución única, hash y límites del Administrador', async () => {
    const rutaClaves = new URL('../.env.integral.local', import.meta.url);
    let clavesPrueba;
    try { clavesPrueba = dotenv.parse(await readFile(rutaClaves)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; clavesPrueba = { CUENTA_PASSWORD: randomBytes(24).toString('base64url') }; await writeFile(rutaClaves, `CUENTA_PASSWORD=${clavesPrueba.CUENTA_PASSWORD}\n`, { flag: 'wx', mode: 0o600 }); }
    const catalogo = await datos('cuentas/catalogos', 'director');
    const [[preexistente]] = await pool.execute("SELECT id FROM usuarios WHERE nombre_usuario = 'rvega'");
    if (!preexistente) {
      const persona = catalogo.personas.find((p) => p.nombre === 'Rosa Milagros Vega Carrillo');
      const autorizacion = await datos('cuentas/autorizaciones', 'director', 'POST', { tipo: 'crear_cuenta', id_persona: persona.id, id_rol_objetivo: usuarios.docente.id_rol, nombre_usuario: 'rvega', activo: true, motivo: 'Habilitar el acceso del personal docente autorizado.' }, 201);
      assert.equal((await peticion(`cuentas/autorizaciones/${autorizacion.id}/ejecutar`, 'docente', 'POST', {})).status, 403);
      await datos(`cuentas/autorizaciones/${autorizacion.id}/ejecutar`, 'administrador', 'POST', { contrasena: clavesPrueba.CUENTA_PASSWORD });
      assert.equal((await peticion(`cuentas/autorizaciones/${autorizacion.id}/ejecutar`, 'administrador', 'POST', { contrasena: clavesPrueba.CUENTA_PASSWORD })).status, 409);
    }
    const [[creada]] = await pool.execute("SELECT contrasena_hash FROM usuarios WHERE nombre_usuario = 'rvega'");
    assert.ok(creada.contrasena_hash.startsWith('scrypt$')); assert.ok(creada.contrasena_hash !== clavesPrueba.CUENTA_PASSWORD);
    assert.equal((await peticion('cuentas/autorizaciones', 'director', 'POST', { tipo: 'restablecer_clave', id_usuario_objetivo: usuarios.director.id, motivo: 'Cambio sobre la propia cuenta.' })).status, 403);
    assert.equal((await peticion('cuentas/autorizaciones', 'administrador', 'POST', { tipo: 'restablecer_clave', id_usuario_objetivo: usuarios.director.id, motivo: 'Sin autorización independiente.' })).status, 403);
    const permiso = catalogo.permisos.find((p) => p.codigo === 'incidencias.consultar');
    assert.equal((await peticion('cuentas/autorizaciones', 'director', 'POST', { tipo: 'asignar_permiso', id_rol_objetivo: usuarios.administrador.id_rol, id_permiso: permiso.id, motivo: 'Permiso incompatible con el rol.' })).status, 403);
    const revocar = await datos('cuentas/autorizaciones', 'director', 'POST', { tipo: 'retirar_permiso', id_rol_objetivo: usuarios.docente.id_rol, id_permiso: permiso.id, motivo: 'Comprobar la revocación efectiva del acceso autorizado.' }, 201);
    try {
      await datos(`cuentas/autorizaciones/${revocar.id}/ejecutar`, 'administrador', 'POST', {});
      assert.equal((await peticion('incidencias', 'docente')).status, 403);
    } finally {
      const devolver = await datos('cuentas/autorizaciones', 'director', 'POST', { tipo: 'asignar_permiso', id_rol_objetivo: usuarios.docente.id_rol, id_permiso: permiso.id, motivo: 'Restituir el permiso tras la comprobación controlada.' }, 201);
      await datos(`cuentas/autorizaciones/${devolver.id}/ejecutar`, 'administrador', 'POST', {});
    }
    assert.equal((await peticion('incidencias', 'docente')).status, 200);
    const [[objetivo]] = await pool.execute("SELECT id FROM usuarios WHERE nombre_usuario = 'rvega'");
    const autorizacionClave = await datos('cuentas/autorizaciones', 'director', 'POST', { tipo: 'restablecer_clave', id_usuario_objetivo: objetivo.id, motivo: 'Restablecimiento autorizado por la autoridad independiente.' }, 201);
    await datos(`cuentas/autorizaciones/${autorizacionClave.id}/ejecutar`, 'administrador', 'POST', { contrasena: clavesPrueba.CUENTA_PASSWORD });
    const acceso = await peticion('auth/login', null, 'POST', { usuario: 'rvega', contrasena: clavesPrueba.CUENTA_PASSWORD }); assert.equal(acceso.status, 200);
    const cookieObjetivo = acceso.headers.get('set-cookie').split(';')[0];
    for (const activo of [false, true]) {
      const autorizacion = await datos('cuentas/autorizaciones', 'director', 'POST', { tipo: 'actualizar_cuenta', id_usuario_objetivo: objetivo.id,
        id_rol_objetivo: usuarios.docente.id_rol, nombre_usuario: 'rvega', activo, motivo: activo ? 'Reactivar la cuenta tras la comprobación de seguridad.' : 'Suspender el acceso mediante un cambio concreto autorizado.' }, 201);
      await datos(`cuentas/autorizaciones/${autorizacion.id}/ejecutar`, 'administrador', 'POST', {});
      assert.equal((await fetch(`${base}/api/auth/sesion`, { headers: { Cookie: cookieObjetivo } })).status, 401);
    }
  });
  await t.test('PDF A4, siete secciones, registrador histórico y firma/sello sin cortes', async () => {
    await mkdir(new URL('../.local/verificacion/', import.meta.url), { recursive: true });
    const response = await peticion(`incidencias/${ids[18]}/pdf`, 'subdirector'); assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/pdf/);
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(new URL('../.local/verificacion/informe-institucional.pdf', import.meta.url), buffer);
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
    const extendido = await generarInforme(largo); await writeFile(new URL('../.local/verificacion/informe-extenso.pdf', import.meta.url), extendido);
    const pdfLargo = await getDocument({ data: new Uint8Array(extendido), useSystemFonts: true }).promise; assert.ok(pdfLargo.numPages > 5);
    const ultimo = (await (await pdfLargo.getPage(pdfLargo.numPages)).getTextContent()).items.map((i) => i.str).join(' ');
    assert.ok(ultimo.includes('Firma del registrador') && ultimo.includes('Sello del Director'));
    assert.ok(ultimo.length > 700, 'La última página del informe extenso debe conservar texto junto a las firmas.');
    await pdf.cleanup?.(); await pdfLargo.cleanup?.();
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
});
