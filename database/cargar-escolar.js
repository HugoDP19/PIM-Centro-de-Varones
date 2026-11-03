import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { createDatabasePool, transaccion } from '../src/database.js';
import { crearHash, limitesPermisos } from '../src/seguridad.js';
import { insertar, auditar } from '../src/consultas-incidencias.js';
import { casos } from './casos-demo.js';
import { crearCaso, crearEscenarioEspecial, nombresRoles } from './cargar-demo.js';

export const personalEscolar = [
  ['director', 'Ricardo Alberto', 'Salazar Mendoza', 'rsalazar'],
  ['subdirector', 'María Elena', 'Huamán Rojas', 'mhuaman'],
  ['coordinador_tutoria', 'José Luis', 'Paredes Díaz', 'jparedes'],
  ['docente', 'Lucía Patricia', 'Ramos Vega', 'lramos'],
  ['auxiliar', 'Carlos Enrique', 'Torres Castillo', 'ctorres'],
  ['administrador', 'Valeria Inés', 'Gutiérrez Ponce', 'vgutierrez']
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
    datos = Object.fromEntries(personalEscolar.map(([rol]) => [`${rol.toUpperCase()}_PASSWORD`, randomBytes(24).toString('base64url')]));
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

function presentacionEscolar(caso) {
  const limpiar = (valor) => typeof valor === 'string' ? valor
    .replace(/este registro de demostración/g, 'este registro')
    .replace(/de demostración/g, 'documentada')
    .replace(/escenario DEMO-11/g, 'expediente original de la instalación eléctrica') : valor;
  return Object.fromEntries(Object.entries({ ...caso, escolar: true }).map(([k, v]) => [k, limpiar(v)]));
}

export async function cargarEscolar() {
  if (process.env.NODE_ENV !== 'development' || process.env.DB_NAME !== 'sice_desarrollo' || process.env.DB_HOST !== '127.0.0.1') throw new Error('Carga permitida únicamente en sice_desarrollo local y modo development.');
  const pool = createDatabasePool();
  try {
    return await transaccion(pool, async (db) => {
      const [[bloqueo]] = await db.execute("SELECT GET_LOCK('sice_coleccion_escolar', 0) AS adquirido");
      if (!bloqueo.adquirido) throw new Error('Otra carga está en curso.');
      try {
        const [[existente]] = await db.execute("SELECT COUNT(*) AS cantidad FROM historial WHERE accion = 'carga_escolar'");
        if (Number(existente.cantidad) === 24) {
          try { await readFile(new URL('../.env.escolar.local', import.meta.url)); }
          catch (error) { if (error.code === 'ENOENT') throw new Error('La colección ya existe; conserva o recupera .env.escolar.local. No se restablecen sus contraseñas.'); throw error; }
          return { cargadas: 0, existentes: 24 };
        }
        if (Number(existente.cantidad)) throw new Error('La colección está incompleta; no se sobrescribe.');
        const datos = await identidades(db, await clavesEscolares());
        const coleccion = casos.map(presentacionEscolar);
        coleccion.push({ numero: 19, escolar: true, categoria: 'seguridad', tipo: 'Reporte con testigo adulto protegido',
          titulo: 'Observación reservada en el acceso al colegio', fecha: '2026-10-28 17:10:00', lugar: 'Acceso de secundaria', registrador: 'subdirector', reportante: 'docente',
          alumnos: [[8, 'afectado']], adultos: [{ id: datos.testigo }], prioridad: 'alta', estado: 'en_seguimiento', restringida: true,
          descripcion: 'La docente comunicó que un estudiante solicitó apoyo al advertir una discusión cerca del acceso al colegio. Un trabajador externo que se encontraba en el lugar aportó información sobre el momento en que se produjo el intercambio y solicitó que su identidad se tratara de manera reservada. La autoridad recogió el reporte sin atribuir responsabilidad antes de contrastar los relatos. La persona adulta queda relacionada como testigo y no se le asigna una matrícula estudiantil.',
          campos: { riesgo_identificado: 'Discusión próxima al acceso; secuencia pendiente de contraste.', riesgo_persistente: 0 },
          actuacion: 'Se acompañó al estudiante y se coordinó una evaluación reservada del reporte. Se protegió el expediente completo y se dejó pendiente la verificación por la autoridad habilitada.' });
        const registros = {};
        for (const caso of coleccion.sort((a, b) => a.numero - b.numero)) {
          const registro = await crearCaso(db, caso, datos);
          registros[caso.numero] = registro;
          if (caso.especial) await crearEscenarioEspecial(db, caso, registro, registros, datos);
          if (caso.estado !== 'confirmada') {
            await db.execute('UPDATE incidencias SET estado = ? WHERE id = ?', [caso.estado, registro.id]);
            await auditar(db, caso.estado === 'anulada' ? datos.usuarios.subdirector : registro.responsable, registro.id, 'estado_actualizado', {
              campo: 'estado', valor_anterior: 'confirmada', valor_nuevo: caso.estado });
          }
        }
        return { cargadas: 24, existentes: 0 };
      } finally { await db.execute("SELECT RELEASE_LOCK('sice_coleccion_escolar')"); }
    });
  } finally { await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await cargarEscolar())); }
  catch (error) { console.error(error.code ? `Carga detenida (${error.code}); transacción revertida.` : error.message); process.exitCode = 1; }
}
