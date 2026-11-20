import { Router } from 'express';
import { autorizar, reautenticar } from './autenticacion.js';
import { actorVigente } from './cuentas.js';
import { transaccion } from './database.js';
import { rechazar, validarTexto, validarIdentificador, tienePermiso } from './seguridad.js';
import * as consultas from './consultas-incidencias.js';

const misma = (a, b) => String(a) === String(b);
const valor = (v) => v instanceof Date ? v.toISOString() : String(v ?? '');
const participantes = (filas) => JSON.stringify(filas.map(f => [String(f.id_persona), String(f.id_matricula || ''), f.participacion]).sort());

function campos(cuerpo, permitidos) {
  if (!cuerpo || Object.keys(cuerpo).some(c => !permitidos.includes(c))) rechazar(400, 'Campos de operación no permitidos.');
}

// Impide que el solicitante decida su propio cambio, incluso si usa otra cuenta de la misma persona.
async function independiente(db, actor, solicitud) {
  if (misma(actor.id, solicitud.id_solicitante) || misma(actor.id_persona, solicitud.id_persona_solicitante)) {
    rechazar(403, 'La decisión exige una autoridad independiente del solicitante.');
  }
  if (!['director', 'subdirector'].includes(actor.rol)) rechazar(403, 'Solo una autoridad puede evaluar o resolver.');
}

export function rutasCambios(pool, { obtener, validarRegistro, validarConfirmacion }) {
  const router = Router();
  // Bloquea el expediente y guarda la propuesta sin sustituir los hechos ni participantes vigentes.
  router.post('/:id/solicitudes', autorizar('incidencias.solicitar'), async (req, res) => {
    campos(req.body, ['tipo', 'justificacion', 'propuesta', 'motivo_anulacion', 'id_incidencia_duplicada', 'contrasena']);
    const justificacion = validarTexto(req.body.justificacion, 'justificación', 5000);
    if (!['rectificacion', 'anulacion'].includes(req.body.tipo)) rechazar(400, 'Tipo de solicitud no válido.');
    await reautenticar(pool, req);
    const resultado = await transaccion(pool, async db => {
      const actor = await actorVigente(db, req.usuario, 'incidencias.solicitar', req.tokenSesion);
      const incidencia = await obtener(db, actor, req.params.id, true);
      if (!['confirmada', 'en_seguimiento'].includes(incidencia.estado)) rechazar(409, 'La solicitud requiere un expediente confirmado y abierto.');
      if ((await consultas.solicitudesPendientes(db, incidencia.id)).length) rechazar(409, 'Ya existe una solicitud pendiente.');
      const datos = { id_incidencia: incidencia.id, id_solicitante: actor.id, id_rol_solicitante: actor.id_rol,
        tipo: req.body.tipo, justificacion, creada_en: new Date(), estado: 'pendiente', id_version_base: incidencia.id_version_vigente };
      if (datos.tipo === 'rectificacion') {
        if (req.body.motivo_anulacion || req.body.id_incidencia_duplicada) rechazar(400, 'La rectificación no incluye anulación.');
        const propuesta = await validarRegistro(db, actor, req.body.propuesta);
        if (propuesta.prioridad !== incidencia.prioridad) rechazar(400, 'La rectificación conserva la prioridad vigente.');
        const numero = await consultas.numeroVersion(db, incidencia.id);
        datos.id_version_propuesta = await consultas.insertar(db, 'versiones_incidencia', { ...propuesta.version,
          id_incidencia: incidencia.id, numero_version: numero, estado_version: 'propuesta', id_autor: actor.id, creada_en: new Date() });
        for (const persona of propuesta.involucrados) await consultas.insertar(db, 'involucrados', { id_version: datos.id_version_propuesta, ...persona });
        const detalle = await consultas.detalleIncidencia(db, { ...incidencia, id_version_vigente: datos.id_version_propuesta });
        await validarConfirmacion(db, detalle);
        datos.confidencialidad_propuesta = propuesta.confidencialidad;
        if (propuesta.confidencialidad === 'restringida' && incidencia.confidencialidad !== 'restringida') {
          await consultas.fijarEstado(db, incidencia.id, { confidencialidad: 'restringida' });
          incidencia.confidencialidad = 'restringida';
          await consultas.auditar(db, actor, incidencia.id, 'confidencialidad_elevada', { motivo: 'La propuesta incorpora contenido reservado.' });
        }
      } else {
        if (req.body.propuesta) rechazar(400, 'La anulación no contiene una versión propuesta.');
        if (!['duplicado', 'otro'].includes(req.body.motivo_anulacion)) rechazar(400, 'Indica el motivo de anulación.');
        datos.motivo_anulacion = req.body.motivo_anulacion;
        if (datos.motivo_anulacion === 'duplicado') {
          const destino = await obtener(db, actor, validarIdentificador(req.body.id_incidencia_duplicada));
          if (misma(destino.id, incidencia.id) || !['confirmada', 'en_seguimiento', 'cerrada'].includes(destino.estado)) rechazar(400, 'Selecciona otro expediente válido que continuará conservado.');
          datos.id_incidencia_duplicada = destino.id;
        } else if (req.body.id_incidencia_duplicada) rechazar(400, 'No corresponde un expediente duplicado.');
      }
      const id = await consultas.insertar(db, 'solicitudes_cambio', datos);
      await consultas.auditar(db, actor, incidencia.id, 'solicitud_presentada', { id_solicitud: id,
        id_version: datos.id_version_propuesta || datos.id_version_base, motivo: justificacion });
      return { id, estado: 'pendiente', acceso: incidencia.confidencialidad === 'interna' || tienePermiso(actor, 'incidencias.restringidas') };
    });
    res.status(201).json(resultado);
  });

  // Distingue errores materiales de cambios que obligan a revisión formal y conserva la evaluación.
  router.post('/:id/solicitudes/:solicitud/evaluar', autorizar('incidencias.resolver'), async (req, res) => {
    campos(req.body, ['requiere_revision', 'fundamento', 'sin_conflicto', 'contrasena']);
    if (typeof req.body.requiere_revision !== 'boolean' || req.body.sin_conflicto !== true) rechazar(400, 'Declara la revisión necesaria y tu independencia.');
    const fundamento = validarTexto(req.body.fundamento, 'fundamento', 500);
    await reautenticar(pool, req);
    await transaccion(pool, async db => {
      const actor = await actorVigente(db, req.usuario, 'incidencias.resolver', req.tokenSesion);
      const incidencia = await obtener(db, actor, req.params.id, true);
      const solicitud = await consultas.solicitudCambio(db, validarIdentificador(req.params.solicitud), incidencia.id);
      if (!solicitud || solicitud.estado !== 'pendiente') rechazar(409, 'Solicitud no disponible o resuelta.');
      await independiente(db, actor, solicitud);
      if (!misma(solicitud.id_version_base, incidencia.id_version_vigente)) rechazar(409, 'La versión base cambió; debe retirarse y presentarse otra solicitud.');
      let formal = solicitud.tipo === 'anulacion' && solicitud.motivo_anulacion !== 'duplicado';
      if (solicitud.id_version_propuesta) {
        const base = await consultas.versionPorId(db, solicitud.id_version_base);
        const propuesta = await consultas.versionPorId(db, solicitud.id_version_propuesta);
        const metadatos = ['id', 'numero_version', 'estado_version', 'id_autor', 'creada_en', 'titulo', 'lugar'];
        formal ||= Object.keys(base).some(c => !metadatos.includes(c) && valor(base[c]) !== valor(propuesta[c]));
        formal ||= participantes(await consultas.participantesVersion(db, base.id)) !== participantes(await consultas.participantesVersion(db, propuesta.id));
      }
      formal ||= incidencia.confidencialidad === 'restringida' && solicitud.confidencialidad_propuesta === 'interna';
      if (formal && !req.body.requiere_revision) rechazar(409, 'El cambio exige revisión formal y acta; no puede resolverse como error material.');
      if (solicitud.id_incidencia_duplicada) await obtener(db, actor, solicitud.id_incidencia_duplicada);
      await consultas.actualizarSolicitud(db, solicitud.id, { id_evaluador: actor.id, evaluada_en: new Date(),
        requiere_revision: Number(req.body.requiere_revision), fundamento_revision: fundamento });
      await consultas.auditar(db, actor, incidencia.id, 'solicitud_evaluada', { id_solicitud: solicitud.id, motivo: fundamento,
        campo: 'requiere_revision', valor_anterior: solicitud.requiere_revision === null ? null : String(solicitud.requiere_revision),
        valor_nuevo: String(Number(req.body.requiere_revision)) });
    });
    res.json({ estado: 'pendiente' });
  });

  // Revalida la base y aplica decisión, versión vigente o anulación de forma atómica.
  router.post('/:id/solicitudes/:solicitud/decidir', autorizar('incidencias.resolver'), async (req, res) => {
    campos(req.body, ['decision', 'fundamento', 'sin_conflicto', 'contrasena']);
    if (!['aprobar', 'rechazar'].includes(req.body.decision) || req.body.sin_conflicto !== true) rechazar(400, 'Indica decisión e independencia.');
    const fundamento = validarTexto(req.body.fundamento, 'fundamento', 5000);
    await reautenticar(pool, req);
    const estado = await transaccion(pool, async db => {
      const actor = await actorVigente(db, req.usuario, 'incidencias.resolver', req.tokenSesion);
      const incidencia = await obtener(db, actor, req.params.id, true);
      const solicitud = await consultas.solicitudCambio(db, validarIdentificador(req.params.solicitud), incidencia.id);
      if (!solicitud || solicitud.estado !== 'pendiente' || !solicitud.id_evaluador) rechazar(409, 'La solicitud necesita evaluación independiente o ya fue resuelta.');
      await independiente(db, actor, solicitud);
      if (!misma(solicitud.id_version_base, incidencia.id_version_vigente) || !['confirmada', 'en_seguimiento'].includes(incidencia.estado)) rechazar(409, 'La base o el estado cambiaron; la solicitud no puede aplicarse.');
      if (req.body.decision === 'aprobar') {
        if (Number(solicitud.requiere_revision)) rechazar(409, 'Se requiere revisión formal y acta con composición y quórum institucional definidos.');
        if (solicitud.confidencialidad_propuesta === 'interna' && incidencia.confidencialidad === 'restringida') rechazar(409, 'No se rebaja la reserva de versiones o evidencias conservadas.');
        if (solicitud.tipo === 'anulacion') {
          const destino = await obtener(db, actor, solicitud.id_incidencia_duplicada, true);
          if (!['confirmada', 'en_seguimiento', 'cerrada'].includes(destino.estado)) rechazar(409, 'El expediente de referencia dejó de ser válido.');
          await consultas.fijarEstado(db, incidencia.id, { estado: 'anulada' });
        } else {
          await consultas.editarVersion(db, solicitud.id_version_propuesta, { estado_version: 'confirmada' });
          await consultas.fijarEstado(db, incidencia.id, { id_version_vigente: solicitud.id_version_propuesta });
        }
      }
      const resultado = req.body.decision === 'aprobar' ? 'aprobada' : 'rechazada';
      await consultas.actualizarSolicitud(db, solicitud.id, { estado: resultado, id_decisor: actor.id,
        id_rol_decisor: actor.id_rol, fundamento_decision: fundamento, decidida_en: new Date() });
      await consultas.auditar(db, actor, incidencia.id, 'solicitud_resuelta', { id_solicitud: solicitud.id,
        id_version: solicitud.id_version_propuesta || solicitud.id_version_base, valor_nuevo: resultado, motivo: fundamento });
      return resultado;
    });
    res.json({ estado });
  });

  // Marca la solicitud como retirada por su autor, conservando la propuesta y el motivo.
  router.post('/:id/solicitudes/:solicitud/retirar', autorizar('incidencias.solicitar'), async (req, res) => {
    campos(req.body, ['motivo', 'contrasena']);
    const motivo = validarTexto(req.body.motivo, 'motivo', 1000);
    await reautenticar(pool, req);
    await transaccion(pool, async db => {
      const actor = await actorVigente(db, req.usuario, 'incidencias.solicitar', req.tokenSesion);
      const incidencia = await obtener(db, actor, req.params.id, true);
      const solicitud = await consultas.solicitudCambio(db, validarIdentificador(req.params.solicitud), incidencia.id);
      if (!solicitud || solicitud.estado !== 'pendiente') rechazar(409, 'La solicitud no está pendiente.');
      if (!misma(solicitud.id_solicitante, actor.id)) rechazar(403, 'Solo el solicitante puede retirarla.');
      await consultas.actualizarSolicitud(db, solicitud.id, { estado: 'retirada' });
      await consultas.auditar(db, actor, incidencia.id, 'solicitud_retirada', { id_solicitud: solicitud.id, motivo });
    });
    res.json({ estado: 'retirada' });
  });

  // Cierre y reapertura añaden actuaciones e historial; no restauran anulaciones ni omiten pendientes.
  router.post('/:id/estado', autorizar('incidencias.cerrar'), async (req, res) => {
    campos(req.body, ['accion', 'motivo', 'seguimiento_revisado', 'contrasena']);
    if (!['cerrar', 'reabrir'].includes(req.body.accion)) rechazar(400, 'Operación de estado no válida.');
    if (req.body.accion === 'cerrar' && req.body.seguimiento_revisado !== true) rechazar(400, 'Confirma la revisión de actuaciones y plazos pendientes.');
    const motivo = validarTexto(req.body.motivo, 'motivo', 5000);
    await reautenticar(pool, req);
    const estado = await transaccion(pool, async db => {
      const actor = await actorVigente(db, req.usuario, 'incidencias.cerrar', req.tokenSesion);
      const incidencia = await obtener(db, actor, req.params.id, true);
      const cerrar = req.body.accion === 'cerrar';
      if (cerrar ? !['confirmada', 'en_seguimiento'].includes(incidencia.estado) : incidencia.estado !== 'cerrada') rechazar(409, 'El estado actual no permite esta operación.');
      if ((await consultas.solicitudesPendientes(db, incidencia.id)).length) rechazar(409, 'Hay solicitudes pendientes; primero deben resolverse o retirarse.');
      const estado = cerrar ? 'cerrada' : 'en_seguimiento';
      const id = await consultas.insertar(db, 'actuaciones', { id_incidencia: incidencia.id, id_autor: actor.id,
        id_rol_autor: actor.id_rol, tipo: 'actuacion', detalle: `${cerrar ? 'Conclusión' : 'Reapertura'}: ${motivo}`,
        realizada_en: new Date(), registrada_en: new Date(), id_responsable: actor.id });
      await consultas.fijarEstado(db, incidencia.id, { estado });
      await consultas.auditar(db, actor, incidencia.id, cerrar ? 'incidencia_cerrada' : 'incidencia_reabierta', {
        id_actuacion: id, campo: 'estado', valor_anterior: incidencia.estado, valor_nuevo: estado, motivo });
      return estado;
    });
    res.json({ estado });
  });
  return router;
}
