import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { createDatabasePool } from '../src/database.js';
import { crearHash, roles } from '../src/seguridad.js';
import { casos } from './casos-demo.js';

const nombresRoles = ['Director', 'Subdirector', 'Coordinador de Tutoría', 'Docente', 'Auxiliar', 'Administrador'];
const fechaBase = '2026-03-02 12:00:00';
const fecha = (valor, minutos = 0) => new Date(new Date(`${valor.replace(' ', 'T')}Z`).getTime() + minutos * 60000).toISOString().slice(0, 19).replace('T', ' ');

export function minutosSeguimiento(caso) {
  if (caso.minutosActuacion) return caso.minutosActuacion;
  if (['aprobada', 'rechazada', 'duplicado'].includes(caso.especial)) return 181;
  if (caso.especial === 'reunion') return 160;
  if (caso.especial === 'conflicto') return 65;
  return 20;
}

// Solo recibe nombres de tablas/columnas escritos en este archivo, nunca entradas HTTP.
async function insertar(db, tabla, datos) {
  const columnas = Object.keys(datos);
  const [resultado] = await db.execute(`INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`, Object.values(datos));
  return resultado.insertId;
}

async function historial(db, actor, accion, instante, destino = {}) {
  await insertar(db, 'historial', { id_actor: actor.id, id_rol_actor: actor.id_rol, ocurrido_en: instante, accion, ...destino });
}

async function crearIdentidades(db, claves) {
  const usuarios = {};
  const personas = {};
  for (const [indice, rol] of roles.entries()) {
    const idRol = await insertar(db, 'roles', { codigo: rol, nombre: nombresRoles[indice] });
    const idPersona = await insertar(db, 'personas', { codigo_interno: `DEMO-P${indice + 1}`, nombres: `Personal ${indice + 1}`, apellidos: 'Demostración Ficticia', es_personal: 1, activo: 1 });
    const id = await insertar(db, 'usuarios', { id_persona: idPersona, id_rol: idRol,
      nombre_usuario: `demo.${rol}`, contrasena_hash: await crearHash(claves[rol]), activo: 1, creado_en: fechaBase });
    usuarios[rol] = { id, id_rol: idRol, id_persona: idPersona, nombre: `Personal ${indice + 1} Demostración Ficticia` };
    personas[rol] = { id: idPersona, nombre: usuarios[rol].nombre, condicion: 'personal' };
  }
  const permisos = {
    'sesion.consultar': roles,
    'cuentas.administrar': ['administrador'],
    'cuentas.autorizar': ['director', 'subdirector']
  };
  for (const [codigo, permitidos] of Object.entries(permisos)) {
    const idPermiso = await insertar(db, 'permisos', { codigo, descripcion: `Permiso técnico de demostración: ${codigo}` });
    for (const rol of permitidos) await insertar(db, 'roles_permisos', { id_rol: usuarios[rol].id_rol, id_permiso: idPermiso });
  }
  for (let numero = 1; numero <= 4; numero++) {
    const id = await insertar(db, 'personas', { codigo_interno: `DEMO-A${numero}`, nombres: `Apoderada ${numero}`, apellidos: 'Demostración Ficticia', es_personal: 0, activo: 1 });
    personas[`apoderado${numero}`] = { id, nombre: `Apoderada ${numero} Demostración Ficticia`, condicion: 'apoderado' };
  }
  const aulas = [];
  for (const [nivel, grado, seccion] of [['primaria', 5, 'A'], ['primaria', 6, 'B'], ['secundaria', 2, 'A'], ['secundaria', 3, 'B']]) {
    aulas.push(await insertar(db, 'aulas', { anio_lectivo: 2026, nivel, grado, seccion, activo: 1 }));
  }
  const estudiantes = {};
  const nombres = ['Alonso', 'Bruno', 'Camilo', 'Darío', 'Elías', 'Fabio', 'Gabriel', 'Héctor'];
  for (let numero = 1; numero <= 8; numero++) {
    const id = await insertar(db, 'personas', { codigo_interno: `DEMO-E${numero}`, nombres: nombres[numero - 1], apellidos: `Ficticio Demo ${numero}`, es_personal: 0, activo: 1 });
    await insertar(db, 'estudiantes', { id_persona: id, codigo_estudiante: `DEMO-EST-${numero}`, activo: 1 });
    const grupo = Math.floor((numero - 1) / 2);
    const matricula = await insertar(db, 'matriculas', { id_estudiante: id, id_aula: aulas[grupo], fecha_inicio: '2026-03-02' });
    const apoderado = personas[`apoderado${grupo + 1}`];
    await insertar(db, 'estudiantes_apoderados', { id_estudiante: id, id_apoderado: apoderado.id, vinculo: 'madre', es_principal: 1, vigente_desde: '2026-03-02' });
    estudiantes[numero] = { id, matricula, nombre: `${nombres[numero - 1]} Ficticio Demo ${numero}`, apoderado };
  }
  return { usuarios, personas, estudiantes };
}

async function crearCaso(db, caso, identidades) {
  const { usuarios, personas, estudiantes } = identidades;
  const registrador = usuarios[caso.registrador || 'docente'];
  const reportante = personas[caso.reportante || caso.registrador || 'docente'];
  const [[tipoExistente]] = await db.execute('SELECT id FROM tipos_incidencia WHERE categoria = ? AND nombre = ?', [caso.categoria, caso.tipo]);
  const tipo = tipoExistente?.id || await insertar(db, 'tipos_incidencia', {
    categoria: caso.categoria, nombre: caso.tipo, minimo_estudiantes: caso.alumnos.length ? 1 : 0, activo: 1
  });
  const registrada = fecha(caso.fecha, caso.numero === 22 ? 30 : 10);
  const confirmada = fecha(registrada, 5);
  const id = await insertar(db, 'incidencias', { id_registrador: registrador.id, id_rol_registrador: registrador.id_rol,
    nombre_registrador: registrador.nombre, registrada_en: registrada, estado: 'borrador', prioridad: caso.prioridad,
    confidencialidad: caso.restringida ? 'restringida' : 'interna' });
  const versionDatos = { id_incidencia: id, numero_version: 1, estado_version: 'confirmada', id_autor: registrador.id,
    creada_en: confirmada, id_tipo: tipo, titulo: `[DEMO-${String(caso.numero).padStart(2, '0')}] ${caso.titulo}`,
    descripcion: caso.descripcion, ocurrida_en: caso.fecha, lugar: caso.lugar, id_reportante: reportante.id,
    condicion_reportante: reportante.condicion, nombre_reportante: reportante.nombre, ...caso.campos };
  const version = await insertar(db, 'versiones_incidencia', versionDatos);
  for (const [numero, participacion] of caso.alumnos) {
    const alumno = estudiantes[numero];
    await insertar(db, 'involucrados', { id_version: version, id_estudiante: alumno.id, id_matricula: alumno.matricula, participacion });
  }
  await db.execute('UPDATE incidencias SET id_version_vigente = ?, confirmada_en = ?, estado = ? WHERE id = ?', [version, confirmada, 'confirmada', id]);
  await historial(db, registrador, 'demo_confirmada', confirmada, { id_incidencia: id, id_version: version });
  const responsable = usuarios[caso.restringida ? 'subdirector' : 'coordinador_tutoria'];
  const seguimiento = minutosSeguimiento(caso);
  const actuacion = await insertar(db, 'actuaciones', { id_incidencia: id, id_autor: responsable.id, id_rol_autor: responsable.id_rol,
    tipo: 'actuacion', detalle: caso.actuacion, realizada_en: fecha(confirmada, seguimiento), registrada_en: fecha(confirmada, seguimiento + 1),
    id_responsable: responsable.id, fecha_limite: fecha(confirmada, 7 * 24 * 60).slice(0, 10) });
  await historial(db, responsable, 'demo_actuacion', fecha(confirmada, seguimiento + 1), { id_incidencia: id, id_actuacion: actuacion });
  // Protección: no asumir que contactar a la familia siempre es seguro.
  if (caso.alumnos.length && caso.categoria !== 'proteccion_estudiantil') {
    const alumno = estudiantes[caso.alumnos[0][0]];
    const comunicacion = await insertar(db, 'actuaciones', { id_incidencia: id, id_autor: responsable.id, id_rol_autor: responsable.id_rol,
      tipo: 'actuacion', detalle: `Se comunicó a ${alumno.apoderado.nombre}, apoderada de ${alumno.nombre}, la atención escolar y los próximos pasos descritos en este expediente. Se solicitó aportar información pertinente por un canal reservado, sin divulgar datos de otros estudiantes. Comunicación ficticia para demostración.`,
      realizada_en: fecha(confirmada, 30), registrada_en: fecha(confirmada, 31), id_responsable: responsable.id });
    await historial(db, responsable, 'demo_comunicacion', fecha(confirmada, 31), { id_incidencia: id, id_actuacion: comunicacion });
  }
  return { id, version, versionDatos, registrador, confirmada, responsable };
}

async function crearEscenarioEspecial(db, caso, registro, registros, identidades) {
  const { usuarios, personas, estudiantes } = identidades;
  const { id, version, versionDatos, registrador, confirmada } = registro;
  const decisor = usuarios.subdirector;
  let propuesta = null;
  if (caso.especial !== 'duplicado') {
    let descripcion = `${caso.descripcion}\nPropuesta pendiente: precisar la actividad o la fecha referida sin borrar la versión original.`;
    if (caso.especial === 'aprobada') descripcion = 'El docente observó una señal con fijación suelta en el acceso de secundaria. El auxiliar verificó la ubicación y aseguró la señal. La versión anterior consignaba el pasillo de primaria por un error de anotación. Esta versión incorpora únicamente la ubicación contrastada mediante revisión independiente; la observación original y la solicitud se conservan.';
    if (caso.especial === 'rechazada') descripcion = 'Propuesta del solicitante: registrar que el cuaderno fue recuperado. La información recibida todavía no permite confirmar la entrega al estudiante. Esta propuesta se conserva como rechazada y no sustituye la versión vigente.';
    propuesta = await insertar(db, 'versiones_incidencia', { ...versionDatos, numero_version: 2, estado_version: caso.especial === 'aprobada' ? 'confirmada' : 'propuesta', creada_en: fecha(confirmada, 40), descripcion,
      lugar: caso.especial === 'aprobada' ? 'Acceso de secundaria' : caso.lugar });
    for (const [numero, participacion] of caso.alumnos) {
      const alumno = estudiantes[numero];
      await insertar(db, 'involucrados', { id_version: propuesta, id_estudiante: alumno.id, id_matricula: alumno.matricula, participacion });
    }
  }
  const resuelta = ['aprobada', 'rechazada', 'duplicado'].includes(caso.especial);
  const evaluada = caso.especial !== 'conflicto';
  const solicitud = await insertar(db, 'solicitudes_cambio', { id_incidencia: id, id_solicitante: registrador.id,
    id_rol_solicitante: registrador.id_rol, tipo: caso.especial === 'duplicado' ? 'anulacion' : 'rectificacion',
    justificacion: caso.especial === 'duplicado' ? 'Se comprobó que ambos registros describen el mismo cable expuesto, en el mismo lugar e instante.' : 'Se solicita contrastar la precisión documental descrita en la propuesta, conservando el contenido anterior.',
    creada_en: fecha(confirmada, 45), estado: resuelta ? (caso.especial === 'rechazada' ? 'rechazada' : 'aprobada') : 'pendiente',
    id_version_base: version, id_version_propuesta: propuesta,
    motivo_anulacion: caso.especial === 'duplicado' ? 'duplicado' : null,
    id_incidencia_duplicada: caso.especial === 'duplicado' ? registros[11].id : null,
    id_evaluador: evaluada ? decisor.id : null, evaluada_en: evaluada ? fecha(confirmada, 60) : null,
    requiere_revision: evaluada ? Number(caso.especial === 'reunion') : null,
    fundamento_revision: evaluada ? 'Escenario sintético de revisión documental; los criterios institucionales siguen pendientes de aprobación.' : null,
    id_decisor: resuelta ? decisor.id : null, id_rol_decisor: resuelta ? decisor.id_rol : null,
    fundamento_decision: resuelta ? (caso.especial === 'rechazada' ? 'No hay evidencia suficiente de entrega; permanece vigente el relato anterior.' : 'La documentación sintética permite corroborar la corrección solicitada sin sustituir la evidencia original.') : null,
    decidida_en: resuelta ? fecha(confirmada, 180) : null });
  await historial(db, registrador, 'demo_solicitud_presentada', fecha(confirmada, 45), { id_incidencia: id, id_solicitud: solicitud });
  if (evaluada) await historial(db, decisor, 'demo_solicitud_evaluada', fecha(confirmada, 60), { id_incidencia: id, id_solicitud: solicitud });
  if (resuelta) await historial(db, decisor, 'demo_solicitud_resuelta', fecha(confirmada, 180), { id_incidencia: id, id_solicitud: solicitud, valor_nuevo: caso.especial === 'rechazada' ? 'rechazada' : 'aprobada' });
  if (caso.especial === 'aprobada') {
    await db.execute('UPDATE incidencias SET id_version_vigente = ? WHERE id = ?', [propuesta, id]);
    await historial(db, decisor, 'demo_version_vigente', fecha(confirmada, 180), { id_incidencia: id, id_version: propuesta,
      campo: 'id_version_vigente', valor_anterior: String(version), valor_nuevo: String(propuesta) });
  }
  if (caso.especial === 'reunion') {
    const revision = await insertar(db, 'revisiones', { id_incidencia: id, id_solicitud: solicitud, id_responsable: decisor.id,
      motivo: 'Contrastar la precisión solicitada mediante una reunión de demostración.', abierta_en: fecha(confirmada, 70), cerrada_en: fecha(confirmada, 150),
      estado: 'concluida', requiere_reunion: 1, hubo_reunion: 1, reunion_en: fecha(confirmada, 100), requiere_acta: 1,
      fundamento_acta: 'Conservar los aportes de la reunión de demostración; no fija criterios institucionales.',
      acta: 'Acta sintética: se explicó el objeto de la solicitud y se escucharon los aportes de las personas relacionadas como participantes. Se contrastó la actividad realizada por el grupo y se acordó mantener acompañamiento. La conclusión se remite a una autoridad independiente; esta acta no aprueba la solicitud ni modifica los hechos. Los participantes se identifican en su relación, sin listas de nombres dentro del acta.',
      id_emisor_acta: decisor.id, acta_emitida_en: fecha(confirmada, 140), conclusion: 'Se recogieron elementos para evaluar la precisión documental. La decisión de la solicitud permanece pendiente.' });
    const participantes = [[decisor.id_persona, decisor.nombre, 'responsable'], [registrador.id_persona, registrador.nombre, 'solicitante oído'],
      [estudiantes[1].id, estudiantes[1].nombre, 'estudiante oído'], [personas.apoderado1.id, personas.apoderado1.nombre, 'apoderada']];
    for (const [idPersona, nombre, funcion] of participantes) await insertar(db, 'participantes_revision', {
      id_revision: revision, id_persona: idPersona, funcion, asistencia: 'asistio', nombre_participante: nombre, intervencion: 'Aporte sintético sobre la secuencia de la actividad.'
    });
    await historial(db, decisor, 'demo_revision_concluida', fecha(confirmada, 150), { id_incidencia: id, id_revision: revision });
  }
  if (caso.especial === 'conflicto') {
    const director = usuarios.director;
    const conflicto = await insertar(db, 'conflictos_interes', { id_incidencia: id, id_usuario_afectado: director.id,
      id_declarante: director.id, motivo: 'Relación personal declarada con una familia; escenario de inhibición sin decisión del afectado.', declarado_en: fecha(confirmada, 55), estado: 'inhibido' });
    await historial(db, director, 'demo_inhibicion', fecha(confirmada, 55), { id_incidencia: id, id_conflicto: conflicto });
  }
}

export async function cargarDatosDemo(db, claves) {
  // El llamador controla la transacción: permite rollback íntegro en las pruebas.
  const identidades = await crearIdentidades(db, claves);
  const registros = {};
  for (const caso of casos) {
    const registro = await crearCaso(db, caso, identidades);
    registros[caso.numero] = registro;
    if (caso.especial) await crearEscenarioEspecial(db, caso, registro, registros, identidades);
    if (caso.estado !== 'confirmada') {
      await db.execute('UPDATE incidencias SET estado = ? WHERE id = ?', [caso.estado, registro.id]);
      const actor = caso.estado === 'anulada' ? identidades.usuarios.subdirector : registro.responsable;
      await historial(db, actor, 'demo_estado_actualizado', fecha(registro.confirmada, Math.max(190, minutosSeguimiento(caso) + 10)), { id_incidencia: registro.id,
        campo: 'estado', valor_anterior: 'confirmada', valor_nuevo: caso.estado });
    }
  }
  return { ...identidades, registros };
}

async function clavesLocales() {
  const archivo = new URL('../.env.demo.local', import.meta.url);
  let valores;
  try { valores = dotenv.parse(await readFile(archivo)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    valores = Object.fromEntries(roles.map((rol) => [`DEMO_${rol.toUpperCase()}_PASSWORD`, randomBytes(24).toString('base64url')]));
    await writeFile(archivo, '# Credenciales sintéticas solo para desarrollo. No versionar ni compartir.\n' + Object.entries(valores).map(([clave, valor]) => `${clave}=${valor}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  }
  const claves = Object.fromEntries(roles.map((rol) => [rol, valores[`DEMO_${rol.toUpperCase()}_PASSWORD`]]));
  if (Object.values(claves).some((valor) => !valor || valor.length < 15)) throw new Error('Faltan contraseñas demo válidas en .env.demo.local.');
  return claves;
}

async function ejecutar() {
  if (process.env.NODE_ENV !== 'development' || process.env.DB_NAME !== 'sice_desarrollo' || process.env.DB_HOST !== '127.0.0.1') {
    throw new Error('La carga requiere NODE_ENV=development, DB_HOST=127.0.0.1 y DB_NAME=sice_desarrollo.');
  }
  const pool = createDatabasePool();
  const db = await pool.getConnection();
  try {
    const [[bloqueo]] = await db.execute("SELECT GET_LOCK('sice_desarrollo_demo', 0) AS adquirido");
    if (!bloqueo.adquirido) throw new Error('Otra carga de demostración está en curso.');
    const [[{ personas }]] = await db.execute('SELECT COUNT(*) AS personas FROM personas');
    if (Number(personas) > 0) {
      const [[{ cantidad }]] = await db.execute("SELECT COUNT(*) AS cantidad FROM versiones_incidencia WHERE numero_version = 1 AND titulo LIKE '[DEMO-%'");
      const [[{ cuentas }]] = await db.execute("SELECT COUNT(*) AS cuentas FROM usuarios WHERE nombre_usuario LIKE 'demo.%'");
      if (Number(cantidad) !== casos.length || Number(cuentas) !== 6) throw new Error('La base contiene datos distintos o una carga incompleta; se conserva sin sobrescribir.');
      console.log(`Demostración ya presente: ${cantidad} incidencias. No se insertaron ni modificaron filas.`);
      return;
    }
    const [tablas] = await db.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
    for (const tabla of tablas) {
      if (['sesiones', 'intentos_acceso'].includes(tabla.TABLE_NAME)) continue;
      const [[{ cantidad }]] = await db.query(`SELECT COUNT(*) AS cantidad FROM \`${tabla.TABLE_NAME.replaceAll('`', '``')}\``);
      if (Number(cantidad)) throw new Error('La base contiene datos; no se sobrescribe.');
    }
    const claves = await clavesLocales();
    await db.beginTransaction();
    await cargarDatosDemo(db, claves);
    await db.commit();
    console.log(`Cargadas ${casos.length} incidencias sintéticas y 6 cuentas. Credenciales solo en .env.demo.local.`);
  } catch (error) { await db.rollback(); throw error; }
  finally {
    await db.execute("SELECT RELEASE_LOCK('sice_desarrollo_demo')");
    db.release(); await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await ejecutar(); }
  catch (error) { console.error(error.code ? `Carga demo detenida (${error.code}); transacción revertida.` : error.message); process.exitCode = 1; }
}
