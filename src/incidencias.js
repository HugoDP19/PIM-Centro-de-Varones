import { Router } from 'express';
import { autorizar } from './autenticacion.js';
import { rechazar, tienePermiso, validarIdentificador, validarTexto } from './seguridad.js';
import { transaccion } from './database.js';
import * as consultas from './consultas-incidencias.js';
import { generarInforme } from './informes.js';

export const camposCategoria = {
  convivencia: ['ambito_convivencia', 'requiere_mediacion'],
  disciplina: ['gravedad_disciplinaria', 'norma_referida'],
  salud: ['sintomas_observados', 'requiere_atencion_inmediata'],
  seguridad: ['riesgo_identificado', 'riesgo_persistente'],
  bienes: ['descripcion_dano', 'monto_estimado', 'moneda'],
  proteccion_estudiantil: ['riesgo_inmediato', 'requiere_derivacion']
};
const camposEspecificos = Object.values(camposCategoria).flat();
const booleanos = ['requiere_mediacion', 'requiere_atencion_inmediata', 'riesgo_persistente', 'riesgo_inmediato', 'requiere_derivacion'];
const obligatoriosAlConfirmar = {
  convivencia: ['ambito_convivencia', 'requiere_mediacion'], disciplina: ['gravedad_disciplinaria'],
  salud: ['sintomas_observados', 'requiere_atencion_inmediata'], seguridad: ['riesgo_identificado', 'riesgo_persistente'],
  bienes: ['descripcion_dano'], proteccion_estudiantil: ['riesgo_inmediato', 'requiere_derivacion']
};

function fechaHecho(valor) {
  if (valor === null || valor === '' || valor === undefined) return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.test(valor)
      || !fechaCivilValida(valor.slice(0, 10)) || Number(valor.slice(11, 13)) > 23) rechazar(400, 'Fecha y hora no válidas.');
  const fecha = new Date(valor);
  if (!Number.isFinite(fecha.getTime()) || fecha.getTime() > Date.now() + 60000) rechazar(400, 'La fecha del hecho debe ser válida y no estar en el futuro.');
  return fecha;
}

function fechaCivilValida(valor) {
  const fecha = typeof valor === 'string' && /^\d{4}-\d\d-\d\d$/.test(valor) ? new Date(`${valor}T00:00:00Z`) : null;
  return fecha && Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

// Interpreta la fecha civil de Lima y valida los filtros antes de consultar MySQL.
function filtrosListado(consulta) {
  const buscar = consulta.buscar ? validarTexto(consulta.buscar, 'búsqueda', 100) : '';
  const categoria = consulta.categoria || '', estado = consulta.estado || '';
  if (typeof categoria !== 'string' || typeof estado !== 'string') rechazar(400, 'Filtros de búsqueda no válidos.');
  if (categoria && !Object.hasOwn(camposCategoria, categoria)) rechazar(400, 'Categoría de búsqueda no válida.');
  if (estado && !['borrador', 'confirmada', 'en_seguimiento', 'cerrada', 'anulada'].includes(estado)) rechazar(400, 'Estado de búsqueda no válido.');
  const filtros = { buscar, categoria, estado };
  const codigo = buscar.match(/^(?:INC-)?(\d{1,20})$/i);
  const fecha = buscar.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (codigo) filtros.codigo = validarIdentificador(String(BigInt(codigo[1])));
  else if (fecha) {
    const civil = `${fecha[3]}-${fecha[2]}-${fecha[1]}`;
    if (!fechaCivilValida(civil)) rechazar(400, 'La fecha del hecho debe ser válida y usar dd/mm/aaaa.');
    filtros.desde = new Date(`${civil}T00:00:00-05:00`);
    filtros.hasta = new Date(filtros.desde.getTime() + 86400000);
  }
  return filtros;
}

async function personaPermitida(conexion, identificador, personasPermitidas) {
  const idPersona = validarIdentificador(identificador);
  if (!personasPermitidas.has(idPersona)) rechazar(403, 'No puedes seleccionar esa identidad desde este acceso.');
  return consultas.persona(conexion, idPersona);
}

async function validarReportante(conexion, cuerpo, personasPermitidas) {
  const reportante = await personaPermitida(conexion, cuerpo.id_reportante, personasPermitidas);
  const condicion = cuerpo.condicion_reportante;
  if (!['personal', 'estudiante', 'apoderado', 'externo'].includes(condicion)
      || (condicion === 'personal' && !reportante.es_personal)
      || (condicion === 'estudiante' && !reportante.es_estudiante)
      || (condicion === 'apoderado' && !reportante.es_apoderado)
      || (condicion === 'externo' && (reportante.es_personal || reportante.es_estudiante || reportante.es_apoderado))) rechazar(400, 'La condición del reportante no coincide con su identidad.');
  return { id_reportante: reportante.id, condicion_reportante: condicion, nombre_reportante: `${reportante.nombres} ${reportante.apellidos}` };
}

function validarCamposCategoria(cuerpo, categoria) {
  const valores = {};
  for (const campo of camposEspecificos) {
    const valor = cuerpo[campo];
    if (!camposCategoria[categoria].includes(campo) && valor !== undefined && valor !== null && valor !== '') rechazar(400, 'Hay campos que no corresponden a la categoría seleccionada.');
    if (valor === undefined || valor === null || valor === '') valores[campo] = null;
    else if (booleanos.includes(campo)) {
      if (typeof valor !== 'boolean') rechazar(400, `Indica sí o no en ${campo}.`);
      valores[campo] = Number(valor);
    } else if (campo === 'monto_estimado') {
      if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 9999999999.99 || !/^\d+(\.\d{1,2})?$/.test(String(valor))) rechazar(400, 'El importe estimado no es válido; usa como máximo dos decimales.');
      valores[campo] = valor;
    } else valores[campo] = validarTexto(valor, campo, ['sintomas_observados', 'riesgo_identificado', 'descripcion_dano'].includes(campo) ? 5000 : 100);
  }
  if (valores.gravedad_disciplinaria && !['por_evaluar', 'leve', 'grave', 'muy_grave'].includes(valores.gravedad_disciplinaria)) rechazar(400, 'Gravedad disciplinaria no válida.');
  if (valores.ambito_convivencia && !['presencial', 'digital', 'mixto'].includes(valores.ambito_convivencia)) rechazar(400, 'Ámbito de convivencia no válido.');
  if ((valores.monto_estimado === null) !== (valores.moneda === null) || (valores.moneda && !/^[A-Z]{3}$/.test(valores.moneda))) rechazar(400, 'El importe y su moneda deben completarse juntos.');
  return valores;
}

async function validarMatricula(conexion, idMatricula, persona, ocurridaEn) {
  if (!idMatricula) return;
  const matricula = await consultas.matricula(conexion, idMatricula);
  if (!persona.es_estudiante || !matricula || String(matricula.id_estudiante) !== String(persona.id)) rechazar(400, 'La matrícula debe pertenecer al estudiante seleccionado.');
  const dia = ocurridaEn?.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  if (dia && (dia < matricula.fecha_inicio.toISOString().slice(0, 10) || (matricula.fecha_fin && dia > matricula.fecha_fin.toISOString().slice(0, 10)))) rechazar(400, 'La matrícula no corresponde a la fecha del hecho.');
}

async function validarInvolucrados(conexion, filas, personasPermitidas, ocurridaEn) {
  if (!Array.isArray(filas) || filas.length > 50) rechazar(400, 'Revisa las personas involucradas.');
  const involucrados = [];
  for (const fila of filas) {
    if (!fila || typeof fila !== 'object' || Array.isArray(fila) || Object.keys(fila).some((campo) => !['id_persona', 'id_matricula', 'participacion'].includes(campo))) rechazar(400, 'Datos de participación no válidos.');
    const idPersona = validarIdentificador(fila.id_persona);
    if (involucrados.some((p) => p.id_persona === idPersona)) rechazar(400, 'Una persona no puede repetirse en la misma versión.');
    const persona = await personaPermitida(conexion, idPersona, personasPermitidas);
    if (!['afectado', 'testigo', 'involucrado'].includes(fila.participacion)) rechazar(400, 'Participación no válida.');
    const idMatricula = fila.id_matricula ? validarIdentificador(fila.id_matricula) : null;
    await validarMatricula(conexion, idMatricula, persona, ocurridaEn);
    involucrados.push({ id_persona: idPersona, id_matricula: idMatricula, participacion: fila.participacion });
  }
  return involucrados;
}

export async function validarRegistro(conexion, usuario, cuerpo) {
  const permitidos = ['id_tipo', 'titulo', 'descripcion', 'ocurrida_en', 'lugar', 'id_reportante', 'condicion_reportante',
    'prioridad', 'confidencialidad', 'contenido_sensible', 'involucrados', ...camposEspecificos];
  if (!cuerpo || Object.keys(cuerpo).some(campo => !permitidos.includes(campo))) rechazar(400, 'La solicitud contiene campos no permitidos; la autoría se obtiene de la sesión.');
  const tipo = await consultas.tipoIncidencia(conexion, validarIdentificador(cuerpo.id_tipo));
  if (!tipo) rechazar(400, 'Selecciona un tipo de incidencia activo.');
  const catalogo = await consultas.catalogos(conexion, usuario);
  const personasPermitidas = new Set(catalogo.personas.map(persona => String(persona.id)));
  const reportante = await validarReportante(conexion, cuerpo, personasPermitidas);
  if (!['baja', 'normal', 'alta', 'urgente'].includes(cuerpo.prioridad)) rechazar(400, 'Selecciona una prioridad válida.');
  if (!['interna', 'restringida'].includes(cuerpo.confidencialidad) || typeof cuerpo.contenido_sensible !== 'boolean') rechazar(400, 'Indica la confidencialidad y si existe contenido sensible.');
  const version = {
    id_tipo: tipo.id, titulo: validarTexto(cuerpo.titulo, 'título', 200), descripcion: validarTexto(cuerpo.descripcion, 'descripción', 20000),
    ocurrida_en: fechaHecho(cuerpo.ocurrida_en), lugar: cuerpo.lugar ? validarTexto(cuerpo.lugar, 'lugar', 255) : null,
    ...reportante, ...validarCamposCategoria(cuerpo, tipo.categoria)
  };
  const involucrados = await validarInvolucrados(conexion, cuerpo.involucrados, personasPermitidas, version.ocurrida_en);
  return { version, involucrados, prioridad: cuerpo.prioridad,
    confidencialidad: cuerpo.contenido_sensible || ['salud', 'proteccion_estudiantil'].includes(tipo.categoria) ? 'restringida' : cuerpo.confidencialidad };
}

async function obtener(db, usuario, id, bloquear = false) {
  const incidencia = await consultas.buscarIncidencia(db, usuario, validarIdentificador(id), bloquear);
  if (!incidencia) rechazar(404, 'Expediente no disponible para este acceso.');
  return incidencia;
}

async function auditarInvolucrados(db, usuario, incidencia, version, filas, accion) {
  for (const fila of filas) await consultas.auditar(db, usuario, incidencia, accion, { id_version: version,
    id_persona: fila.id_persona, id_matricula: fila.id_matricula, campo: 'participacion',
    ...(accion === 'involucrado_retirado' ? { valor_anterior: fila.participacion } : { valor_nuevo: fila.participacion }) });
}

export function rutasIncidencias(pool) {
  const router = Router();
  router.use((req, _res, next) => {
    if (req.usuario.rol === 'administrador') rechazar(403, 'El Administrador no tiene acceso a expedientes.');
    next();
  });
  router.get('/catalogos', autorizar('incidencias.registrar'), async (req, res) => res.json(await consultas.catalogos(pool, req.usuario)));
  router.get('/', autorizar('incidencias.consultar'), async (req, res) => {
    const filtros = filtrosListado(req.query);
    const pagina = req.query.pagina ?? '1';
    if (typeof pagina !== 'string' || !/^[1-9]\d{0,6}$/.test(pagina)) rechazar(400, 'Selecciona una página válida.');
    // Contar y leer con la misma instantánea y el mismo alcance de autorización.
    res.json(await transaccion(pool, db => consultas.listarIncidencias(db, req.usuario, { ...filtros, pagina: Number(pagina) })));
  });
  router.post('/', autorizar('incidencias.registrar'), async (req, res) => {
    const id = await transaccion(pool, async (db) => {
      const datos = await validarRegistro(db, req.usuario, req.body);
      const id = await consultas.insertar(db, 'incidencias', { id_registrador: req.usuario.id, id_rol_registrador: req.usuario.id_rol,
        nombre_registrador: req.usuario.nombre, registrada_en: new Date(), estado: 'borrador', prioridad: datos.prioridad, confidencialidad: datos.confidencialidad });
      const version = await consultas.insertar(db, 'versiones_incidencia', { ...datos.version, id_incidencia: id,
        numero_version: 1, estado_version: 'borrador', id_autor: req.usuario.id, creada_en: new Date() });
      await consultas.reemplazarInvolucrados(db, version, datos.involucrados);
      await consultas.fijarEstado(db, id, { id_version_vigente: version });
      await consultas.auditar(db, req.usuario, id, 'incidencia_creada', { id_version: version });
      await auditarInvolucrados(db, req.usuario, id, version, datos.involucrados, 'involucrado_agregado');
      return id;
    });
    res.status(201).json({ id, estado: 'borrador' });
  });
  router.get('/:id/pdf', autorizar('incidencias.exportar'), async (req, res) => {
    if (!tienePermiso(req.usuario, 'incidencias.consultar')) rechazar(403, 'No tienes permiso de consulta.');
    const resultado = await transaccion(pool, async (db) => {
      const incidencia = await obtener(db, req.usuario, req.params.id, true);
      if (incidencia.estado === 'borrador') rechazar(409, 'Confirma el expediente antes de generar su informe.');
      const datos = await consultas.detalleIncidencia(db, incidencia);
      const pdf = await generarInforme(datos);
      await consultas.auditar(db, req.usuario, incidencia.id, 'informe_exportado');
      return { datos, pdf };
    });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="INC-${resultado.datos.incidencia.id}.pdf"` });
    res.send(resultado.pdf);
  });
  router.get('/:id', autorizar('incidencias.consultar'), async (req, res) => {
    const datos = await transaccion(pool, async (db) => {
      const incidencia = await obtener(db, req.usuario, req.params.id, true);
      const datos = await consultas.detalleIncidencia(db, incidencia);
      if (incidencia.confidencialidad === 'restringida') await consultas.auditar(db, req.usuario, incidencia.id, 'expediente_consultado');
      return datos;
    });
    res.json(datos);
  });
  router.put('/:id/borrador', autorizar('incidencias.registrar'), async (req, res) => {
    await transaccion(pool, async (db) => {
      const incidencia = await obtener(db, req.usuario, req.params.id, true);
      if (incidencia.estado !== 'borrador' || String(incidencia.id_registrador) !== String(req.usuario.id)) rechazar(409, 'Solo puedes editar tus borradores. Los hechos confirmados requieren una solicitud.');
      const datos = await validarRegistro(db, req.usuario, req.body);
      const anterior = await consultas.detalleIncidencia(db, incidencia);
      for (const [campo, valor] of Object.entries(datos.version)) {
        const previo = anterior.version[campo];
        if (String(previo ?? '') !== String(valor ?? '')) await consultas.auditar(db, req.usuario, incidencia.id, 'borrador_editado', {
          id_version: anterior.version.id, campo, valor_anterior: previo === null ? null : String(previo), valor_nuevo: valor === null ? null : String(valor)
        });
      }
      await auditarInvolucrados(db, req.usuario, incidencia.id, anterior.version.id, anterior.involucrados, 'involucrado_retirado');
      await consultas.editarVersion(db, anterior.version.id, datos.version);
      await consultas.reemplazarInvolucrados(db, anterior.version.id, datos.involucrados);
      await auditarInvolucrados(db, req.usuario, incidencia.id, anterior.version.id, datos.involucrados, 'involucrado_agregado');
      const operativos = { prioridad: datos.prioridad, confidencialidad: incidencia.confidencialidad === 'restringida' ? 'restringida' : datos.confidencialidad };
      for (const [campo, valor] of Object.entries(operativos)) if (incidencia[campo] !== valor) await consultas.auditar(db, req.usuario, incidencia.id, 'borrador_editado', {
        campo, valor_anterior: incidencia[campo], valor_nuevo: valor
      });
      await consultas.fijarEstado(db, incidencia.id, operativos);
    });
    res.json({ estado: 'borrador' });
  });
  router.post('/:id/confirmar', autorizar('incidencias.registrar'), async (req, res) => {
    const resultado = await transaccion(pool, async (db) => {
      const incidencia = await obtener(db, req.usuario, req.params.id, true);
      if (incidencia.estado !== 'borrador' || String(incidencia.id_registrador) !== String(req.usuario.id)) rechazar(409, 'La confirmación solo admite un borrador propio.');
      const datos = await consultas.detalleIncidencia(db, incidencia);
      if (!await consultas.tipoIncidencia(db, datos.version.id_tipo)) rechazar(400, 'El tipo de incidencia ya no está activo.');
      const reportante = await consultas.persona(db, datos.version.id_reportante);
      if (!reportante?.activo) rechazar(400, 'Revisa la identidad del reportante antes de confirmar.');
      for (const campo of obligatoriosAlConfirmar[datos.version.categoria]) {
        if (datos.version[campo] === null || datos.version[campo] === '') rechazar(400, `Completa el campo ${campo} antes de confirmar.`);
      }
      const estudiantes = datos.involucrados.filter((p) => p.es_estudiante).length;
      if (estudiantes < datos.version.minimo_estudiantes) rechazar(400, `Este tipo exige al menos ${datos.version.minimo_estudiantes} estudiante(s).`);
      await consultas.editarVersion(db, datos.version.id, { estado_version: 'confirmada' });
      await consultas.fijarEstado(db, incidencia.id, { estado: 'confirmada', confirmada_en: new Date() });
      await consultas.auditar(db, req.usuario, incidencia.id, 'incidencia_confirmada', { id_version: datos.version.id });
      return { id: incidencia.id, estado: 'confirmada', acceso: incidencia.confidencialidad === 'interna' || tienePermiso(req.usuario, 'incidencias.restringidas') };
    });
    res.json(resultado);
  });
  router.post('/:id/actuaciones', autorizar('incidencias.seguimiento'), async (req, res) => {
    if (!tienePermiso(req.usuario, 'incidencias.consultar')) rechazar(403, 'No tienes permiso de consulta para este seguimiento.');
    const resultado = await transaccion(pool, async (db) => {
      const incidencia = await obtener(db, req.usuario, req.params.id, true);
      if (!['confirmada', 'en_seguimiento'].includes(incidencia.estado)) rechazar(409, 'El expediente no admite seguimiento ordinario en su estado actual.');
      const cuerpo = req.body || {};
      if (Object.keys(cuerpo).some((c) => !['tipo', 'detalle', 'id_responsable', 'fecha_limite', 'realizada_en', 'id_actuacion_corregida', 'contenido_sensible'].includes(c))) rechazar(400, 'Campos de seguimiento no permitidos.');
      if (typeof cuerpo.contenido_sensible !== 'boolean') rechazar(400, 'Indica si el seguimiento contiene información sensible.');
      if (!['actuacion', 'observacion'].includes(cuerpo.tipo)) rechazar(400, 'Selecciona actuación u observación.');
      if (cuerpo.contenido_sensible && incidencia.confidencialidad !== 'restringida') {
        await consultas.fijarEstado(db, incidencia.id, { confidencialidad: 'restringida' });
        await consultas.auditar(db, req.usuario, incidencia.id, 'confidencialidad_elevada', { campo: 'confidencialidad', valor_anterior: 'interna', valor_nuevo: 'restringida' });
        incidencia.confidencialidad = 'restringida';
      }
      const responsable = cuerpo.id_responsable ? validarIdentificador(cuerpo.id_responsable) : req.usuario.id;
      if (!await consultas.responsableDelCaso(db, responsable, incidencia)) rechazar(400, 'El responsable debe estar habilitado para este expediente.');
      const correccion = cuerpo.id_actuacion_corregida ? validarIdentificador(cuerpo.id_actuacion_corregida) : null;
      if (correccion && !await consultas.actuacionDelCaso(db, correccion, incidencia.id)) rechazar(400, 'La actuación corregida debe pertenecer al expediente.');
      if (cuerpo.fecha_limite && !fechaCivilValida(cuerpo.fecha_limite)) rechazar(400, 'Fecha límite no válida.');
      const id = await consultas.insertar(db, 'actuaciones', { id_incidencia: incidencia.id,
        id_autor: req.usuario.id, id_rol_autor: req.usuario.id_rol, tipo: cuerpo.tipo, detalle: validarTexto(cuerpo.detalle, 'detalle', 10000),
        realizada_en: fechaHecho(cuerpo.realizada_en) || new Date(), registrada_en: new Date(), id_responsable: responsable,
        fecha_limite: cuerpo.fecha_limite || null, id_actuacion_corregida: correccion });
      await consultas.auditar(db, req.usuario, incidencia.id, 'seguimiento_agregado', { id_actuacion: id });
      if (incidencia.estado === 'confirmada') {
        await consultas.fijarEstado(db, incidencia.id, { estado: 'en_seguimiento' });
        await consultas.auditar(db, req.usuario, incidencia.id, 'estado_actualizado', { campo: 'estado', valor_anterior: 'confirmada', valor_nuevo: 'en_seguimiento' });
      }
      return { id, acceso: incidencia.confidencialidad === 'interna' || tienePermiso(req.usuario, 'incidencias.restringidas') };
    });
    res.status(201).json(resultado);
  });
  router.use((_req, _res) => rechazar(405, 'Esta operación no está habilitada. Los hechos confirmados se conservan.'));
  return router;
}
