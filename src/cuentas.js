import { Router } from 'express';
import { autorizar, reautenticar } from './autenticacion.js';
import { crearHash, resumir, rechazar, limitesPermisos, tienePermiso, validarIdentificador, validarTexto } from './seguridad.js';
import { cargarPermisos } from './consultas-auth.js';
import { transaccion } from './database.js';
import { insertar, auditar } from './consultas-incidencias.js';
import * as consultas from './consultas-cuentas.js';

const camposPorTipo = {
  crear_cuenta: ['id_persona', 'id_rol_objetivo', 'nombre_usuario'],
  editar_cuenta: ['id_usuario_objetivo', 'nombre_usuario'],
  activar_cuenta: ['id_usuario_objetivo'], desactivar_cuenta: ['id_usuario_objetivo'],
  restablecer_clave: ['id_usuario_objetivo'], cambiar_rol: ['id_usuario_objetivo', 'id_rol_objetivo'],
  asignar_permiso: ['id_rol_objetivo', 'id_permiso'], retirar_permiso: ['id_rol_objetivo', 'id_permiso']
};
const autoridades = ['director', 'subdirector'];
const protegidos = [...autoridades, 'administrador'];
const sensiblesDobles = ['cambiar_rol', 'asignar_permiso', 'retirar_permiso'];
const misma = (primera, segunda) => primera != null && segunda != null && String(primera) === String(segunda);
const huella = cuenta => resumir([cuenta.id_rol, cuenta.nombre_usuario, cuenta.activo, cuenta.persona_activa, cuenta.contrasena_hash].join('|'));
const codigoSolicitud = id => `SOL-${String(id).padStart(6, '0')}`;

// Valida los campos según el cambio solicitado; el cliente no decide autorías ni estados.
function leerSolicitud(cuerpo, directa = false) {
  const campos = camposPorTipo[cuerpo.tipo];
  const permitidos = ['tipo', 'motivo', ...(campos || []), ...(directa ? ['contrasena'] : [])];
  if (!campos || Object.keys(cuerpo).some(campo => !permitidos.includes(campo))) rechazar(400, 'Revisa los datos de la operación solicitada.');
  const datos = { tipo: cuerpo.tipo, motivo: validarTexto(cuerpo.motivo, 'motivo', 500) };
  for (const campo of campos) {
    if (campo.startsWith('id_')) datos[campo] = validarIdentificador(cuerpo[campo]);
    else {
      if (typeof cuerpo[campo] !== 'string' || !/^[a-zA-Z0-9._-]{3,60}$/.test(cuerpo[campo])) rechazar(400, 'El usuario debe tener entre 3 y 60 letras, números, puntos, guiones o guiones bajos.');
      datos[campo] = cuerpo[campo];
    }
  }
  if (datos.tipo === 'crear_cuenta' || datos.tipo === 'desactivar_cuenta') datos.activo = 0;
  if (datos.tipo === 'activar_cuenta') datos.activo = 1;
  return datos;
}

// Orden común: gestión, cuenta y expediente; revalida sesión y permisos antes de escribir.
export async function actorVigente(db, usuario, permiso, token) {
  await consultas.bloquearGestion(db);
  const actual = await consultas.cuenta(db, usuario.id, true);
  if (!actual?.activo || !actual.persona_activa || !actual.es_personal
      || actual.contrasena_hash !== usuario.contrasena_hash || !misma(actual.id_rol, usuario.id_rol)
      || !await consultas.sesionVigente(db, token, usuario.id)) rechazar(401, 'La sesión cambió. Inicia sesión nuevamente.');
  const actor = await cargarPermisos(db, { ...usuario, ...actual });
  if (!tienePermiso(actor, permiso)) rechazar(403, 'No tienes autorización para esta operación.');
  return actor;
}

// Rechaza cambios propios, objetivos obsoletos y operaciones que rompan la continuidad de autoridades.
async function validarObjetivo(db, actor, datos) {
  const rol = datos.id_rol_objetivo ? await consultas.rol(db, datos.id_rol_objetivo) : null;
  if (datos.id_rol_objetivo && !rol) rechazar(400, 'Rol no válido.');
  if (datos.tipo === 'crear_cuenta') {
    if (misma(datos.id_persona, actor.id_persona) || !await consultas.personalSinCuenta(db, datos.id_persona)) rechazar(409, 'Selecciona personal activo que todavía no tenga cuenta.');
    return { marca: null, rol };
  }
  if (datos.id_usuario_objetivo) {
    const cuenta = await consultas.cuenta(db, datos.id_usuario_objetivo, true);
    if (!cuenta || !cuenta.persona_activa || !cuenta.es_personal) rechazar(400, 'La cuenta no pertenece a personal activo.');
    if (misma(cuenta.id, actor.id) || misma(cuenta.id_persona, actor.id_persona)) rechazar(403, 'No puedes gestionar cambios sobre tu propia cuenta.');
    if (datos.huella_objetivo && datos.huella_objetivo !== huella(cuenta)) rechazar(409, 'La cuenta cambió desde la solicitud. Registra una nueva.');
    if (['activar_cuenta', 'desactivar_cuenta'].includes(datos.tipo) && Number(cuenta.activo) === datos.activo) rechazar(409, 'La cuenta ya tiene el estado solicitado.');
    if (datos.tipo === 'cambiar_rol' && misma(cuenta.id_rol, datos.id_rol_objetivo)) rechazar(409, 'La cuenta ya tiene ese rol.');
    if (datos.tipo === 'editar_cuenta' && cuenta.nombre_usuario === datos.nombre_usuario) rechazar(409, 'El nombre de usuario no ha cambiado.');
    if (cuenta.activo && protegidos.includes(cuenta.rol)
        && (datos.tipo === 'desactivar_cuenta' || datos.tipo === 'cambiar_rol')
        && await consultas.activosDelRol(db, cuenta.id_rol) <= 1) rechazar(409, `No se puede realizar este cambio: es la única cuenta activa de ${cuenta.rol}. Debe mantenerse al menos una cuenta activa de ese rol.`);
    return { marca: huella(cuenta), cuenta, rol };
  }
  const permiso = await consultas.permiso(db, datos.id_permiso);
  if (!permiso || !limitesPermisos[permiso.codigo]?.includes(rol.codigo)) rechazar(403, 'El permiso excede los límites institucionales del rol.');
  if (misma(actor.id_rol, datos.id_rol_objetivo)) rechazar(403, 'No puedes modificar los permisos de tu propio rol.');
  if ((protegidos.includes(rol.codigo) && permiso.codigo.startsWith('cuentas.')) || permiso.codigo === 'sesion.consultar') rechazar(403, 'Este permiso mantiene la continuidad de acceso y gestión institucional.');
  const asignado = await consultas.asignacion(db, datos.id_rol_objetivo, datos.id_permiso);
  const marca = resumir(String(asignado));
  if (datos.huella_objetivo && datos.huella_objetivo !== marca) rechazar(409, 'El permiso cambió desde la solicitud. Registra una nueva.');
  if (asignado === (datos.tipo === 'asignar_permiso')) rechazar(409, 'El permiso ya tiene el estado solicitado.');
  return { marca, rol };
}

function estadoVisible(datos) {
  if (datos.ejecutada_en) return 'ejecutada';
  if (datos.estado === 'legado') return 'vencida';
  if (['pendiente', 'aprobada'].includes(datos.estado) && new Date(datos.vence_en) <= new Date()) return 'vencida';
  return datos.estado;
}

function puedeDecidir(actor, datos) {
  if (!tienePermiso(actor, 'cuentas.autorizar') || estadoVisible(datos) !== 'pendiente'
      || misma(actor.id, datos.id_solicitante) || misma(actor.id, datos.id_usuario_objetivo)
      || datos[`decision_${actor.rol}`]) return false;
  return datos.rol_solicitante === 'administrador' || (autoridades.includes(datos.rol_solicitante) && datos.rol_solicitante !== actor.rol);
}

// Combina las decisiones de ambas autoridades sin resolver unilateralmente un desacuerdo.
function resolverEstado(datos) {
  if (!datos.revision_doble) return [datos.decision_director, datos.decision_subdirector].includes('aprobar') ? 'aprobada' : 'rechazada';
  if (!datos.decision_director || !datos.decision_subdirector) return 'pendiente';
  if (datos.decision_director === 'rechazar') return 'rechazada';
  return datos.decision_subdirector === 'aprobar' ? 'aprobada' : 'desacuerdo';
}

async function registrar(db, actor, datos, accion, id, objetivo = datos.id_usuario_objetivo, detalle = {}) {
  await auditar(db, actor, null, accion, { id_usuario_afectado: objetivo || null, id_persona: datos.id_persona || null,
    id_rol_afectado: datos.id_rol_objetivo || null, id_permiso: datos.id_permiso || null,
    campo: 'autorizacion_cuenta', valor_nuevo: String(id), motivo: datos.motivo, ...detalle });
}

async function ejecutarCambio(db, datos, hash) {
  let objetivo = datos.id_usuario_objetivo;
  if (datos.tipo === 'crear_cuenta') objetivo = await insertar(db, 'usuarios', { id_persona: datos.id_persona, id_rol: datos.id_rol_objetivo,
    nombre_usuario: datos.nombre_usuario, activo: 0, contrasena_hash: hash, creado_en: new Date() });
  if (datos.tipo === 'editar_cuenta') await consultas.cambiarCuenta(db, objetivo, { nombre_usuario: datos.nombre_usuario });
  if (['activar_cuenta', 'desactivar_cuenta'].includes(datos.tipo)) await consultas.cambiarCuenta(db, objetivo, { activo: datos.activo });
  if (datos.tipo === 'cambiar_rol') await consultas.cambiarCuenta(db, objetivo, { id_rol: datos.id_rol_objetivo });
  if (datos.tipo === 'restablecer_clave') await consultas.cambiarCuenta(db, objetivo, { contrasena_hash: hash });
  if (['asignar_permiso', 'retirar_permiso'].includes(datos.tipo)) await consultas.cambiarPermiso(db, datos.id_rol_objetivo, datos.id_permiso, datos.tipo === 'asignar_permiso');
  return objetivo;
}

export function rutasCuentas(pool) {
  const router = Router();
  router.use(autorizar('cuentas.consultar'));
  router.get('/catalogos', async (_req, res) => res.json(await consultas.catalogosCuentas(pool)));
  router.get('/:id/historial', async (req, res) => {
    const id = validarIdentificador(req.params.id);
    if (!(await consultas.cuenta(pool, id))?.es_personal) rechazar(404, 'Cuenta del personal no encontrada.');
    res.json({ historial: await consultas.historialCuenta(pool, id) });
  });
  router.get('/autorizaciones', async (req, res) => {
    const solicitudes = await consultas.solicitudes(pool);
    const autorizaciones = solicitudes.map(datos => ({ ...datos, codigo: codigoSolicitud(datos.id), estado: estadoVisible(datos),
      puede_decidir: puedeDecidir(req.usuario, datos),
      pendiente_para_usuario: puedeDecidir(req.usuario, datos) || estadoVisible(datos) === 'pendiente' && misma(datos.id_solicitante, req.usuario.id),
      puede_ejecutar: tienePermiso(req.usuario, 'cuentas.ejecutar') && estadoVisible(datos) === 'aprobada'
        && !misma(req.usuario.id, datos.id_usuario_objetivo) && !misma(req.usuario.id, datos.id_autorizante)
        && !misma(req.usuario.id, datos.id_decisor_director) && !misma(req.usuario.id, datos.id_decisor_subdirector) }));
    res.json({ autorizaciones, pendientes: autorizaciones.filter(datos => datos.pendiente_para_usuario).length });
  });

  // Limita la gestión directa del Administrador a las operaciones institucionales permitidas.
  router.post('/directas', autorizar('cuentas.administrar'), async (req, res) => {
    const datos = leerSolicitud(req.body || {}, true);
    if (!['crear_cuenta', 'editar_cuenta'].includes(datos.tipo)) rechazar(403, 'Este cambio requiere una solicitud aprobada.');
    if (datos.tipo === 'editar_cuenta' && req.body.contrasena !== undefined) rechazar(400, 'La edición básica solo cambia el nombre de usuario.');
    const hash = datos.tipo === 'crear_cuenta' ? await crearHash(req.body.contrasena) : null;
    const id = await transaccion(pool, async db => {
      const actor = await actorVigente(db, req.usuario, 'cuentas.administrar', req.tokenSesion);
      const objetivo = await validarObjetivo(db, actor, datos);
      if (protegidos.includes(objetivo.rol?.codigo || objetivo.cuenta?.rol)) rechazar(403, 'Las cuentas de autoridad o Administrador requieren autorización independiente.');
      const id = await ejecutarCambio(db, datos, hash);
      await registrar(db, actor, datos, 'gestion_cuenta_directa', id, id, { campo: 'nombre_usuario',
        valor_anterior: objetivo.cuenta?.nombre_usuario || null, valor_nuevo: datos.nombre_usuario });
      return id;
    });
    res.status(201).json({ id });
  });

  router.post('/autorizaciones', autorizar('cuentas.solicitar'), async (req, res) => {
    const datos = leerSolicitud(req.body || {});
    const resultado = await transaccion(pool, async db => {
      const actor = await actorVigente(db, req.usuario, 'cuentas.solicitar', req.tokenSesion);
      const objetivo = await validarObjetivo(db, actor, datos);
      Object.assign(datos, { huella_objetivo: objetivo.marca, id_solicitante: actor.id, id_rol_solicitante: actor.id_rol,
        solicitada_en: new Date(), vence_en: new Date(Date.now() + 86400000), estado: 'pendiente',
        revision_doble: Number(actor.rol === 'administrador' && (sensiblesDobles.includes(datos.tipo)
          || datos.tipo === 'crear_cuenta' && protegidos.includes(objetivo.rol?.codigo))) });
      // El bloqueo común también serializa reintentos del mismo cambio.
      const existente = await consultas.solicitudEquivalente(db, datos);
      if (existente) return { id: existente.id, existente: true };
      const id = await insertar(db, 'autorizaciones_cuentas', datos);
      await registrar(db, actor, datos, 'gestion_cuenta_solicitada', id);
      return { id, existente: false };
    });
    res.status(resultado.existente ? 200 : 201).json({ ...resultado, codigo: codigoSolicitud(resultado.id) });
  });

  // Reautentica a la autoridad y conserva su decisión independiente sobre el cambio exacto.
  router.post('/autorizaciones/:id/decidir', autorizar('cuentas.autorizar'), async (req, res) => {
    const cuerpo = req.body || {};
    if (Object.keys(cuerpo).some(campo => !['decision', 'fundamento', 'contrasena', 'sin_conflicto'].includes(campo))
        || !['aprobar', 'rechazar'].includes(cuerpo.decision) || cuerpo.sin_conflicto !== true) rechazar(400, 'Indica la decisión y confirma que no tienes conflicto de interés.');
    const fundamento = validarTexto(cuerpo.fundamento, 'fundamento', 500);
    await reautenticar(pool, req);
    await transaccion(pool, async db => {
      const actor = await actorVigente(db, req.usuario, 'cuentas.autorizar', req.tokenSesion);
      const datos = await consultas.autorizacion(db, validarIdentificador(req.params.id));
      if (!datos || estadoVisible(datos) !== 'pendiente') rechazar(409, 'La solicitud ya está resuelta o ha vencido.');
      const solicitante = await consultas.cuenta(db, datos.id_solicitante, true);
      datos.rol_solicitante = (await consultas.rol(db, datos.id_rol_solicitante)).codigo;
      if (!puedeDecidir(actor, datos)) rechazar(403, 'Esta decisión corresponde a una autoridad independiente que todavía no haya decidido.');
      if (!solicitante?.activo || !solicitante.persona_activa || !misma(solicitante.id_rol, datos.id_rol_solicitante)
          || !tienePermiso(await cargarPermisos(db, solicitante), 'cuentas.solicitar')) rechazar(403, 'El solicitante ya no está habilitado.');
      await validarObjetivo(db, actor, datos);
      const cambios = { [`id_decisor_${actor.rol}`]: actor.id, [`decision_${actor.rol}`]: cuerpo.decision,
        [`fundamento_${actor.rol}`]: fundamento, [`decidida_${actor.rol}_en`]: new Date() };
      Object.assign(datos, cambios);
      cambios.estado = resolverEstado(datos);
      if (cambios.estado === 'aprobada') Object.assign(cambios, { id_autorizante: actor.id, id_rol_autorizante: actor.id_rol, autorizada_en: new Date() });
      await consultas.actualizarSolicitud(db, datos.id, cambios);
      await registrar(db, actor, { ...datos, motivo: fundamento }, `gestion_cuenta_${cuerpo.decision === 'aprobar' ? 'aprobada' : 'rechazada'}`, datos.id);
    });
    res.json({ decidida: true });
  });

  // Revalida aprobaciones y objetivos y ejecuta el cambio una sola vez, separado de sus decisores.
  router.post('/autorizaciones/:id/ejecutar', autorizar('cuentas.ejecutar'), async (req, res) => {
    if (Object.keys(req.body || {}).some(campo => campo !== 'contrasena')) rechazar(400, 'La ejecución no puede cambiar los valores aprobados.');
    const hash = req.body?.contrasena !== undefined ? await crearHash(req.body.contrasena) : null;
    await transaccion(pool, async db => {
      const actor = await actorVigente(db, req.usuario, 'cuentas.ejecutar', req.tokenSesion);
      const datos = await consultas.autorizacion(db, validarIdentificador(req.params.id));
      if (!datos || estadoVisible(datos) !== 'aprobada') rechazar(409, 'La solicitud no está aprobada y vigente; no puede ejecutarse.');
      if ([datos.id_autorizante, datos.id_decisor_director, datos.id_decisor_subdirector].some(id => misma(id, actor.id))) rechazar(403, 'Quien decide no puede ejecutar el cambio.');
      const solicitante = await consultas.cuenta(db, datos.id_solicitante, true);
      if (!solicitante?.activo || !solicitante.persona_activa || !misma(solicitante.id_rol, datos.id_rol_solicitante)
          || !tienePermiso(await cargarPermisos(db, solicitante), 'cuentas.solicitar')) rechazar(403, 'El solicitante ya no está habilitado.');
      await validarObjetivo(db, solicitante, datos);
      for (const cargo of autoridades) {
        if (datos[`decision_${cargo}`] !== 'aprobar') continue;
        const autoridad = await consultas.cuenta(db, datos[`id_decisor_${cargo}`], true);
        if (!autoridad?.activo || !autoridad.persona_activa || autoridad.rol !== cargo
            || !tienePermiso(await cargarPermisos(db, autoridad), 'cuentas.autorizar')) rechazar(403, 'Una autoridad que aprobó ya no está habilitada.');
        await validarObjetivo(db, autoridad, datos);
      }
      await validarObjetivo(db, actor, datos);
      if (['crear_cuenta', 'restablecer_clave'].includes(datos.tipo) !== Boolean(hash)) rechazar(400, 'Solo crear o restablecer requiere una contraseña nueva válida.');
      const objetivo = await ejecutarCambio(db, datos, hash);
      await consultas.marcarEjecutada(db, datos.id, actor.id);
      await registrar(db, actor, datos, 'gestion_cuenta_ejecutada', datos.id, objetivo);
    });
    res.json({ ejecutada: true });
  });
  return router;
}
