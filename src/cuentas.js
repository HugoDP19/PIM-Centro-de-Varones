import { Router } from 'express';
import { autorizar } from './autenticacion.js';
import { identificador, texto } from './incidencias.js';
import { crearHash, resumir, rechazar, limitesPermisos, tienePermiso } from './seguridad.js';
import { cargarPermisos } from './consultas-auth.js';
import { transaccion } from './database.js';
import { insertar, auditar } from './consultas-incidencias.js';
import * as consultas from './consultas-cuentas.js';

const tipos = ['crear_cuenta', 'actualizar_cuenta', 'restablecer_clave', 'asignar_permiso', 'retirar_permiso'];
const huella = (cuenta) => resumir(`${cuenta.id_rol}|${cuenta.nombre_usuario}|${cuenta.activo}`);

async function validarObjetivo(db, actor, datos) {
  if (datos.id_usuario_objetivo) {
    const cuenta = await consultas.cuenta(db, datos.id_usuario_objetivo, true);
    if (!cuenta) rechazar(400, 'Cuenta objetivo no válida.');
    if (String(cuenta.id) === String(actor.id) || String(cuenta.id_persona) === String(actor.id_persona)) rechazar(403, 'No puedes autorizar ni ejecutar cambios sensibles sobre tu propia cuenta.');
    if (datos.huella_objetivo && datos.huella_objetivo !== huella(cuenta)) rechazar(409, 'La cuenta cambió desde la autorización; solicita una nueva.');
    return huella(cuenta);
  }
  if (datos.tipo === 'crear_cuenta') {
    if (String(datos.id_persona) === String(actor.id_persona) || !await consultas.personalSinCuenta(db, datos.id_persona)) rechazar(400, 'Selecciona una persona del personal sin cuenta.');
  }
  const rol = datos.id_rol_objetivo ? await consultas.rol(db, datos.id_rol_objetivo) : null;
  if (datos.id_rol_objetivo && !rol) rechazar(400, 'Rol no válido.');
  if (datos.id_permiso) {
    const permiso = await consultas.permiso(db, datos.id_permiso);
    if (!permiso || !limitesPermisos[permiso.codigo]?.includes(rol?.codigo)) rechazar(403, 'Ese permiso excede los límites del rol.');
    if (String(actor.id_rol) === String(datos.id_rol_objetivo)) rechazar(403, 'No puedes cambiar los permisos de tu propio rol.');
    const actual = await consultas.asignacion(db, datos.id_rol_objetivo, datos.id_permiso);
    const marca = resumir(String(actual));
    if (datos.huella_objetivo && datos.huella_objetivo !== marca) rechazar(409, 'La concesión cambió; solicita una nueva autorización.');
    if (actual === (datos.tipo === 'asignar_permiso')) rechazar(409, 'La concesión ya tiene el estado solicitado.');
    return marca;
  }
  return null;
}

export function rutasCuentas(pool) {
  const router = Router();
  router.use(autorizar('cuentas.consultar'));
  router.get('/catalogos', async (_req, res) => res.json(await consultas.catalogosCuentas(pool)));
  router.get('/autorizaciones', async (_req, res) => res.json({ autorizaciones: await consultas.solicitudes(pool) }));
  router.post('/autorizaciones', autorizar('cuentas.autorizar'), async (req, res) => {
    const cuerpo = req.body || {};
    const permitidos = ['tipo', 'id_usuario_objetivo', 'id_persona', 'id_rol_objetivo', 'id_permiso', 'nombre_usuario', 'activo', 'motivo'];
    if (Object.keys(cuerpo).some((c) => !permitidos.includes(c)) || !tipos.includes(cuerpo.tipo)) rechazar(400, 'Solicitud de autorización no válida.');
    const datos = { tipo: cuerpo.tipo, motivo: texto(cuerpo.motivo, 'motivo', 500),
      id_autorizante: req.usuario.id, id_rol_autorizante: req.usuario.id_rol, autorizada_en: new Date(),
      vence_en: new Date(Date.now() + 24 * 60 * 60 * 1000) };
    if (['crear_cuenta', 'actualizar_cuenta'].includes(cuerpo.tipo)) {
      datos.id_rol_objetivo = identificador(cuerpo.id_rol_objetivo);
      if (typeof cuerpo.activo !== 'boolean' || !/^[a-zA-Z0-9._-]{3,60}$/.test(cuerpo.nombre_usuario || '')) rechazar(400, 'Revisa el nombre de usuario y el estado de la cuenta.');
      datos.nombre_usuario = cuerpo.nombre_usuario;
      datos.activo = Number(cuerpo.activo);
    }
    if (cuerpo.tipo === 'crear_cuenta') datos.id_persona = identificador(cuerpo.id_persona);
    else if (['actualizar_cuenta', 'restablecer_clave'].includes(cuerpo.tipo)) datos.id_usuario_objetivo = identificador(cuerpo.id_usuario_objetivo);
    else {
      datos.id_rol_objetivo = identificador(cuerpo.id_rol_objetivo);
      datos.id_permiso = identificador(cuerpo.id_permiso);
    }
    const id = await transaccion(pool, async (db) => {
      datos.huella_objetivo = await validarObjetivo(db, req.usuario, datos);
      if (datos.id_rol_objetivo && !await consultas.rol(db, datos.id_rol_objetivo)) rechazar(400, 'Rol no válido.');
      const id = await insertar(db, 'autorizaciones_cuentas', datos);
      await auditar(db, req.usuario, null, 'gestion_cuenta_autorizada', { id_usuario_afectado: datos.id_usuario_objetivo || null,
        id_persona: datos.id_persona || null, id_rol_afectado: datos.id_rol_objetivo || null, id_permiso: datos.id_permiso || null,
        campo: 'autorizacion_cuenta', valor_nuevo: id, motivo: datos.motivo });
      return id;
    });
    res.status(201).json({ id });
  });
  router.post('/autorizaciones/:id/ejecutar', autorizar('cuentas.administrar'), async (req, res) => {
    if (Object.keys(req.body || {}).some((c) => c !== 'contrasena')) rechazar(400, 'La ejecución no admite cambiar los datos autorizados.');
    if (req.body?.contrasena !== undefined && (typeof req.body.contrasena !== 'string' || req.body.contrasena.length < 15 || Buffer.byteLength(req.body.contrasena) > 256)) rechazar(400, 'La nueva contraseña debe tener al menos 15 caracteres y como máximo 256 bytes.');
    const hash = req.body?.contrasena ? await crearHash(req.body.contrasena) : null;
    await transaccion(pool, async (db) => {
      const datos = await consultas.autorizacion(db, identificador(req.params.id));
      if (!datos || datos.ejecutada_en || datos.vence_en.getTime() <= Date.now()) rechazar(409, 'La autorización no está pendiente o ha vencido.');
      if (String(datos.id_autorizante) === String(req.usuario.id)) rechazar(403, 'La autorización exige ejecución independiente.');
      const autor = await consultas.cuenta(db, datos.id_autorizante, true);
      if (!autor?.activo || !autor.persona_activa || !tienePermiso(await cargarPermisos(db, autor), 'cuentas.autorizar')) rechazar(403, 'La autoridad que autorizó ya no está habilitada.');
      await validarObjetivo(db, autor, datos);
      await validarObjetivo(db, req.usuario, datos);
      if (['crear_cuenta', 'restablecer_clave'].includes(datos.tipo) !== Boolean(hash)) rechazar(400, 'La creación o restablecimiento requiere una contraseña nueva de al menos 15 caracteres.');
      let objetivo = datos.id_usuario_objetivo;
      if (datos.tipo === 'crear_cuenta') objetivo = await insertar(db, 'usuarios', { id_persona: datos.id_persona, id_rol: datos.id_rol_objetivo,
        nombre_usuario: datos.nombre_usuario, activo: datos.activo, contrasena_hash: hash, creado_en: new Date() });
      if (datos.tipo === 'actualizar_cuenta') await consultas.cambiarCuenta(db, objetivo, { id_rol: datos.id_rol_objetivo, nombre_usuario: datos.nombre_usuario, activo: datos.activo });
      if (datos.tipo === 'restablecer_clave') await consultas.cambiarCuenta(db, objetivo, { contrasena_hash: hash });
      if (datos.tipo === 'asignar_permiso' || datos.tipo === 'retirar_permiso') await consultas.cambiarPermiso(db, datos.id_rol_objetivo, datos.id_permiso, datos.tipo === 'asignar_permiso');
      await consultas.marcarEjecutada(db, datos.id, req.usuario.id);
      await auditar(db, req.usuario, null, 'gestion_cuenta_ejecutada', { id_usuario_afectado: objetivo,
        id_rol_afectado: datos.id_rol_objetivo, id_permiso: datos.id_permiso, campo: 'autorizacion_cuenta', valor_nuevo: String(datos.id), motivo: datos.motivo });
    });
    res.json({ ejecutada: true });
  });
  return router;
}
