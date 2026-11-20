import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { createDatabasePool } from '../src/database.js';
import { crearHash, generarContrasena, limitesPermisos } from '../src/seguridad.js';
import { insertar, auditar } from '../src/consultas-incidencias.js';
import { casos, casosAdicionales } from './casos-escolares.js';

export const personalEscolar = [
  ['director', 'Ricardo Alberto', 'Salazar Mendoza', 'rsalazar'],
  ['subdirector', 'María Elena', 'Huamán Rojas', 'mhuaman'],
  ['coordinador_tutoria', 'José Luis', 'Paredes Díaz', 'jparedes'],
  ['docente', 'Lucía Patricia', 'Ramos Vega', 'lramos'],
  ['auxiliar', 'Carlos Enrique', 'Torres Castillo', 'ctorres'],
  ['administrador', 'Hugo', 'Vargas', 'hugodp19']
];
const estudiantesNombres = [
  ['Diego Alonso', 'Quispe Flores'], ['Mateo André', 'Quispe Flores'],
  ['Adrián Sebastián', 'Cárdenas Rojas'], ['Nicolás Gabriel', 'Cárdenas Rojas'],
  ['Joaquín Eduardo', 'Mendoza Paredes'], ['Samuel Ignacio', 'Mendoza Paredes'],
  ['Leonardo Rafael', 'Chávez Huamán'], ['Thiago Daniel', 'Chávez Huamán']
];

async function clavesEscolares() {
  const ruta = new URL('../.env.escolar.local', import.meta.url);
  let datos;
  try { datos = dotenv.parse(await readFile(ruta)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    datos = Object.fromEntries(personalEscolar.map(([rol]) => [`${rol.toUpperCase()}_PASSWORD`, generarContrasena()]));
    await writeFile(ruta, '# Solo desarrollo. Datos personales sintéticos; no compartir ni versionar.\n' + Object.entries(datos).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  }
  for (const [rol] of personalEscolar) if (!datos[`${rol.toUpperCase()}_PASSWORD`]) throw new Error('Falta una contraseña local en .env.escolar.local.');
  return datos;
}

async function identidades(db, claves) {
  const usuarios = {}, personas = {}, estudiantes = {};
  for (const [indice, [rol, nombres, apellidos, nombreUsuario]] of personalEscolar.entries()) {
    const [[r]] = await db.execute('SELECT id FROM roles WHERE codigo = ?', [rol]);
    const idRol = r?.id || await insertar(db, 'roles', { codigo: rol, nombre: nombresRoles[indice] });
    const idPersona = await insertar(db, 'personas', { codigo_interno: `PER-2026-${String(indice + 1).padStart(3, '0')}`, nombres, apellidos, es_personal: 1, activo: 1 });
    const id = await insertar(db, 'usuarios', { id_persona: idPersona, id_rol: idRol, nombre_usuario: nombreUsuario,
      contrasena_hash: await crearHash(claves[`${rol.toUpperCase()}_PASSWORD`]), activo: 1, creado_en: new Date() });
    usuarios[rol] = { id, id_rol: idRol, id_persona: idPersona, nombre: `${nombres} ${apellidos}` };
    personas[rol] = { id: idPersona, nombre: `${nombres} ${apellidos}`, condicion: 'personal' };
  }
  for (const [codigo, permitidos] of Object.entries(limitesPermisos)) {
    await db.execute('INSERT INTO permisos (codigo, descripcion) VALUES (?, ?) ON DUPLICATE KEY UPDATE codigo = codigo', [codigo, `Acción institucional: ${codigo}`]);
    const [[p]] = await db.execute('SELECT id FROM permisos WHERE codigo = ?', [codigo]);
    for (const rol of permitidos) await db.execute('INSERT INTO roles_permisos (id_rol, id_permiso) VALUES (?, ?) ON DUPLICATE KEY UPDATE id_rol = id_rol', [usuarios[rol].id_rol, p.id]);
  }
  const madres = [['Verónica Isabel', 'Flores Medina'], ['Rosa Angélica', 'Rojas Sánchez'], ['Carmen Cecilia', 'Paredes Velásquez'], ['Patricia Susana', 'Huamán Vargas']];
  for (const [indice, [nombres, apellidos]] of madres.entries()) {
    const id = await insertar(db, 'personas', { codigo_interno: `APO-2026-00${indice + 1}`, nombres, apellidos, es_personal: 0, activo: 1 });
    personas[`apoderado${indice + 1}`] = { id, nombre: `${nombres} ${apellidos}`, condicion: 'apoderado' };
  }
  const aulas = [];
  for (const [nivel, grado, seccion] of [['primaria', 5, 'A'], ['primaria', 6, 'B'], ['secundaria', 2, 'A'], ['secundaria', 3, 'B']]) {
    const [[a]] = await db.execute('SELECT id FROM aulas WHERE anio_lectivo = 2026 AND nivel = ? AND grado = ? AND seccion = ?', [nivel, grado, seccion]);
    aulas.push(a?.id || await insertar(db, 'aulas', { anio_lectivo: 2026, nivel, grado, seccion, activo: 1 }));
  }
  for (const [indice, [nombres, apellidos]] of estudiantesNombres.entries()) {
    const id = await insertar(db, 'personas', { codigo_interno: `EST-2026-00${indice + 1}`, nombres, apellidos, es_personal: 0, activo: 1 });
    await insertar(db, 'estudiantes', { id_persona: id, codigo_estudiante: `2026-00${indice + 1}`, activo: 1 });
    const grupo = Math.floor(indice / 2);
    const matricula = await insertar(db, 'matriculas', { id_estudiante: id, id_aula: aulas[grupo], fecha_inicio: '2026-03-02' });
    const apoderado = personas[`apoderado${grupo + 1}`];
    await insertar(db, 'estudiantes_apoderados', { id_estudiante: id, id_apoderado: apoderado.id, vinculo: 'madre', es_principal: 1, vigente_desde: '2026-03-02' });
    estudiantes[indice + 1] = { id, matricula, nombre: `${nombres} ${apellidos}`, apoderado };
  }
  const testigo = await insertar(db, 'personas', { codigo_interno: 'EXT-2026-001', nombres: 'Miguel Ángel', apellidos: 'Soto Benavides', es_personal: 0, activo: 1 });
  for (const [indice, [nombres, apellidos]] of [['Rosa Milagros', 'Vega Carrillo'], ['Luis Fernando', 'Navarro Espinoza']].entries()) {
    await insertar(db, 'personas', { codigo_interno: `PER-2026-10${indice + 1}`, nombres, apellidos, es_personal: 1, activo: 1 });
  }
  return { usuarios, personas, estudiantes, testigo };
}

const nombresRoles = ['Director', 'Subdirector', 'Coordinador de Tutoría', 'Docente', 'Auxiliar', 'Administrador'];
const fecha = (valor, minutos = 0) => new Date(new Date(`${valor.replace(' ', 'T')}Z`).getTime() + minutos * 60000).toISOString().slice(0, 19).replace('T', ' ');

function minutosSeguimiento(caso) {
  if (caso.minutosActuacion) return caso.minutosActuacion;
  if (['aprobada', 'rechazada', 'duplicado'].includes(caso.especial)) return 181;
  if (caso.especial === 'reunion') return 160;
  if (caso.especial === 'conflicto') return 65;
  return 20;
}

async function historial(db, actor, accion, instante, destino = {}) {
  const { id_incidencia, ...referencias } = destino;
  await auditar(db, actor, id_incidencia, accion, { ...referencias, ocurrido_en: instante });
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
    creada_en: confirmada, id_tipo: tipo, titulo: caso.titulo,
    descripcion: caso.descripcion, ocurrida_en: caso.fecha, lugar: caso.lugar, id_reportante: reportante.id,
    condicion_reportante: reportante.condicion, nombre_reportante: reportante.nombre, ...caso.campos };
  const version = await insertar(db, 'versiones_incidencia', versionDatos);
  for (const [numero, participacion] of caso.alumnos) {
    const alumno = estudiantes[numero];
    await insertar(db, 'involucrados', { id_version: version, id_persona: alumno.id, id_matricula: alumno.matricula, participacion });
  }
  for (const adulto of caso.adultos || []) await insertar(db, 'involucrados', { id_version: version, id_persona: adulto.id, participacion: 'testigo' });
  await db.execute('UPDATE incidencias SET id_version_vigente = ?, confirmada_en = ?, estado = ? WHERE id = ?', [version, confirmada, 'confirmada', id]);
  await historial(db, registrador, caso.numero > 24 ? 'carga_escolar_adicional' : 'carga_escolar', confirmada,
    { id_incidencia: id, id_version: version, campo: 'escenario', valor_nuevo: String(caso.numero) });
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
      tipo: 'actuacion', detalle: `Se comunicó a ${alumno.apoderado.nombre}, apoderada de ${alumno.nombre}, la atención escolar y los próximos pasos descritos en este expediente. Se solicitó aportar información pertinente por un canal reservado, sin divulgar datos de otros estudiantes.`,
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
      await insertar(db, 'involucrados', { id_version: propuesta, id_persona: alumno.id, id_matricula: alumno.matricula, participacion });
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
    fundamento_revision: evaluada ? 'Se requiere contrastar las anotaciones y los aportes relacionados con la precisión solicitada.' : null,
    id_decisor: resuelta ? decisor.id : null, id_rol_decisor: resuelta ? decisor.id_rol : null,
    fundamento_decision: resuelta ? (caso.especial === 'rechazada' ? 'No hay evidencia suficiente de entrega; permanece vigente el relato anterior.' : 'Las anotaciones contrastadas permiten corroborar la corrección solicitada sin sustituir la evidencia original.') : null,
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
      motivo: 'Contrastar la precisión solicitada escuchando a las personas relacionadas.', abierta_en: fecha(confirmada, 70), cerrada_en: fecha(confirmada, 150),
      estado: 'concluida', requiere_reunion: 1, hubo_reunion: 1, reunion_en: fecha(confirmada, 100), requiere_acta: 1,
      fundamento_acta: 'Conservar los aportes y la conclusión de la reunión para la evaluación de la solicitud.',
      acta: 'Se explicó el objeto de la solicitud y se escucharon los aportes de las personas relacionadas como participantes. Se contrastó la actividad realizada por el grupo y se acordó mantener acompañamiento. La conclusión se remite a una autoridad independiente; esta acta no aprueba la solicitud ni modifica los hechos. Los participantes se identifican en su relación, sin listas de nombres dentro del acta.',
      id_emisor_acta: decisor.id, acta_emitida_en: fecha(confirmada, 140), conclusion: 'Se recogieron elementos para evaluar la precisión documental. La decisión de la solicitud permanece pendiente.' });
    const participantes = [[decisor.id_persona, decisor.nombre, 'responsable'], [registrador.id_persona, registrador.nombre, 'solicitante oído'],
      [estudiantes[1].id, estudiantes[1].nombre, 'estudiante oído'], [personas.apoderado1.id, personas.apoderado1.nombre, 'apoderada']];
    for (const [idPersona, nombre, funcion] of participantes) await insertar(db, 'participantes_revision', {
      id_revision: revision, id_persona: idPersona, funcion, asistencia: 'asistio', nombre_participante: nombre, intervencion: 'Aportó información sobre la secuencia de la actividad.'
    });
    await historial(db, decisor, 'demo_revision_concluida', fecha(confirmada, 150), { id_incidencia: id, id_revision: revision });
  }
  if (caso.especial === 'conflicto') {
    const director = usuarios.director;
    const conflicto = await insertar(db, 'conflictos_interes', { id_incidencia: id, id_usuario_afectado: director.id,
      id_declarante: director.id, motivo: 'Relación personal declarada con una familia que puede afectar la independencia en la evaluación.', declarado_en: fecha(confirmada, 55), estado: 'inhibido' });
    await historial(db, director, 'demo_inhibicion', fecha(confirmada, 55), { id_incidencia: id, id_conflicto: conflicto });
  }
}

// El llamador controla la transacción; el comando restringe la carga a SICE local.
export async function cargarColeccion(conexion, claves) {
  const [[existente]] = await conexion.execute("SELECT COUNT(*) AS cantidad FROM historial WHERE accion = 'carga_escolar'");
  if (Number(existente.cantidad) === casos.length) return { cargadas: 0, existentes: casos.length };
  if (Number(existente.cantidad)) throw new Error('La colección está incompleta; no se sobrescribe.');
  const datos = await identidades(conexion, claves);
  const registros = {};
  for (const definicion of casos) {
    const caso = { ...definicion, adultos: definicion.testigo_externo ? [{ id: datos.testigo }] : [] };
    const registro = await crearCaso(conexion, caso, datos);
    registros[caso.numero] = registro;
    if (caso.especial) await crearEscenarioEspecial(conexion, caso, registro, registros, datos);
    if (caso.estado !== 'confirmada') {
      await conexion.execute('UPDATE incidencias SET estado = ? WHERE id = ?', [caso.estado, registro.id]);
      const autor = caso.estado === 'anulada' ? datos.usuarios.subdirector : registro.responsable;
      await auditar(conexion, autor, registro.id, 'estado_actualizado', {
        campo: 'estado', valor_anterior: 'confirmada', valor_nuevo: caso.estado
      });
    }
  }
  return { cargadas: casos.length, existentes: 0 };
}

async function identidadesExistentes(db) {
  const usuarios = {}, personas = {}, estudiantes = {};
  for (const [indice, [rol]] of personalEscolar.entries()) {
    const [[usuario]] = await db.execute(`SELECT u.id, u.id_rol, u.id_persona, CONCAT(p.nombres, ' ', p.apellidos) AS nombre
      FROM usuarios u JOIN personas p ON p.id = u.id_persona JOIN roles r ON r.id = u.id_rol
      WHERE p.codigo_interno = ? AND r.codigo = ?`, [`PER-2026-${String(indice + 1).padStart(3, '0')}`, rol]);
    if (!usuario) throw new Error('No se encuentra el personal de la colección original; no se añade información.');
    usuarios[rol] = usuario;
    personas[rol] = { id: usuario.id_persona, nombre: usuario.nombre, condicion: 'personal' };
  }
  const [alumnos] = await db.execute(`SELECT p.id, p.codigo_interno, CONCAT(p.nombres, ' ', p.apellidos) AS nombre,
    m.id AS matricula, CONCAT(pa.nombres, ' ', pa.apellidos) AS apoderado
    FROM personas p JOIN estudiantes e ON e.id_persona = p.id JOIN matriculas m ON m.id_estudiante = p.id
    JOIN aulas a ON a.id = m.id_aula JOIN estudiantes_apoderados ea ON ea.id_estudiante = p.id
    JOIN personas pa ON pa.id = ea.id_apoderado
    WHERE p.codigo_interno LIKE 'EST-2026-%' AND m.fecha_fin IS NULL AND a.anio_lectivo = 2026 AND ea.es_principal = 1`);
  for (const alumno of alumnos) estudiantes[Number(alumno.codigo_interno.slice(-3))] = { ...alumno, apoderado: { nombre: alumno.apoderado } };
  for (const numero of [1, 2, 5, 6]) if (!estudiantes[numero]) throw new Error('Faltan estudiantes o matrículas de la colección original.');
  return { usuarios, personas, estudiantes };
}

// Completa únicamente la colección autorizada; el llamador mantiene la transacción y el bloqueo.
export async function completarColeccion(db) {
  if (process.env.NODE_ENV !== 'development') throw new Error('La ampliación escolar solo está habilitada en desarrollo.');
  const [expedientes] = await db.execute('SELECT id, id_version_vigente FROM incidencias FOR UPDATE');
  const [marcas] = await db.execute("SELECT id_incidencia, valor_nuevo FROM historial WHERE accion = 'carga_escolar_adicional' AND campo = 'escenario'");
  if (expedientes.length === 26 && marcas.length === 2 && new Set(marcas.map(marca => marca.valor_nuevo)).size === 2
      && marcas.every(marca => ['25', '26'].includes(marca.valor_nuevo))) return { cargadas: 0, total: 26, codigos: marcas.map(marca => `INC-${String(marca.id_incidencia).padStart(6, '0')}`) };
  const [[originales]] = await db.execute("SELECT COUNT(DISTINCT id_incidencia) AS total FROM historial WHERE accion = 'carga_escolar' AND campo = 'escenario'");
  if (expedientes.length !== 24 || Number(originales.total) !== 24 || marcas.length || expedientes.some(fila => !fila.id_version_vigente)) {
    throw new Error('Se requieren exactamente los 24 expedientes originales, sin una ampliación previa o parcial.');
  }
  const datos = await identidadesExistentes(db);
  const codigos = [];
  for (const caso of casosAdicionales) {
    const registro = await crearCaso(db, caso, datos);
    const instante = fecha(registro.confirmada, 24 * 60);
    const observacion = await insertar(db, 'actuaciones', { id_incidencia: registro.id,
      id_autor: registro.responsable.id, id_rol_autor: registro.responsable.id_rol, tipo: 'observacion',
      detalle: caso.observacion, realizada_en: instante, registrada_en: instante, id_responsable: registro.responsable.id });
    await historial(db, registro.responsable, 'seguimiento_agregado', instante, { id_incidencia: registro.id, id_actuacion: observacion });
    await db.execute("UPDATE incidencias SET estado = 'en_seguimiento' WHERE id = ?", [registro.id]);
    await historial(db, registro.responsable, 'estado_actualizado', instante, { id_incidencia: registro.id,
      campo: 'estado', valor_anterior: 'confirmada', valor_nuevo: 'en_seguimiento' });
    codigos.push(`INC-${String(registro.id).padStart(6, '0')}`);
  }
  return { cargadas: 2, total: 26, codigos };
}

export async function cargarEscolar(completar = false) {
  if (process.env.NODE_ENV !== 'development' || process.env.DB_NAME?.toUpperCase() !== 'SICE' || process.env.DB_HOST !== '127.0.0.1') {
    throw new Error('La carga solo permite SICE local en modo development.');
  }
  const pool = createDatabasePool();
  const conexion = await pool.getConnection();
  try {
    const [[bloqueo]] = await conexion.execute("SELECT GET_LOCK('sice_coleccion_escolar', 0) AS adquirido");
    if (!bloqueo.adquirido) throw new Error('Otra carga está en curso.');
    await conexion.beginTransaction();
    if (completar) {
      const resultado = await completarColeccion(conexion);
      await conexion.commit();
      return resultado;
    }
    const [[existente]] = await conexion.execute("SELECT COUNT(*) AS cantidad FROM historial WHERE accion = 'carga_escolar'");
    let claves;
    if (Number(existente.cantidad) === casos.length) {
      // No inventar claves nuevas para cuentas ya existentes.
      await readFile(new URL('../.env.escolar.local', import.meta.url));
    } else claves = await clavesEscolares();
    const resultado = await cargarColeccion(conexion, claves);
    await conexion.commit();
    return resultado;
  } catch (error) { await conexion.rollback(); throw error; }
  finally {
    await conexion.execute("SELECT RELEASE_LOCK('sice_coleccion_escolar')");
    conexion.release(); await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.slice(2).some(argumento => argumento !== '--completar-26')) throw new Error('Opción de carga no reconocida.');
    console.log(JSON.stringify(await cargarEscolar(process.argv.includes('--completar-26'))));
  }
  catch (error) {
    console.error(error.code ? 'No se pudo completar la carga; revisa la conexión y las claves locales.' : error.message);
    process.exitCode = 1;
  }
}
