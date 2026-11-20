import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { verificarHash, roles, tienePermiso, permisosEfectivos, resumir, rechazar } from './seguridad.js';
import { limpiarIntentoReautenticacion } from './consultas-cuentas.js';
import { buscarUsuario, cargarPermisos, limitarIntentos, guardarSesion, buscarSesion, borrarSesion, registrarAcceso } from './consultas-auth.js';

export function opcionesCookie(produccion) {
  return { httpOnly: true, secure: produccion, sameSite: 'strict', path: '/' };
}

// Confirma otra vez la identidad y limita en SQL los intentos de operaciones sensibles.
export async function reautenticar(pool, req) {
  const contrasena = req.body?.contrasena;
  if (typeof contrasena !== 'string' || Buffer.byteLength(contrasena) > 256) rechazar(400, 'Confirma tu contraseña actual.');
  if (!await limitarIntentos(pool, `reauth:${req.ip}`, `reauth:${req.usuario.id}`)) rechazar(429, 'Demasiados intentos. Espera 15 minutos.');
  if (!await verificarHash(contrasena, req.usuario.contrasena_hash)) rechazar(403, 'No se pudo confirmar tu identidad. Revisa tu contraseña.');
  await limpiarIntentoReautenticacion(pool, resumir(`cuenta:reauth:${req.usuario.id}`));
}

// Exige JSON y un origen conocido para las escrituras; en producción también requiere HTTPS.
export function protegerSolicitudes({ origin, produccion = false }) {
  return (req, res, next) => {
    if (produccion && !req.secure) return res.status(403).json({ error: 'Se requiere una conexión HTTPS.' });
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (req.get('origin') !== origin || req.get('x-sice-request') !== '1') return res.status(403).json({ error: 'Origen de la solicitud no autorizado.' });
      if (!req.is('application/json')) return res.status(415).json({ error: 'Envía la solicitud en formato JSON.' });
    }
    next();
  };
}

// Acepta una sola cookie con el formato esperado para evitar tokens ambiguos.
function leerToken(req, nombre) {
  const valores = (req.headers.cookie || '').split(';').map((s) => s.trim()).filter((s) => s.startsWith(`${nombre}=`));
  if (valores.length !== 1) return null;
  const token = valores[0].slice(nombre.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

// Expone identidad y permisos efectivos, sin devolver hashes ni datos internos de la cuenta.
function usuarioPublico(usuario) {
  return { id: usuario.id, nombre: usuario.nombre, nombre_usuario: usuario.nombre_usuario,
    rol: usuario.rol, permisos: permisosEfectivos(usuario) };
}

export function autorizar(permiso) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    if (!tienePermiso(req.usuario, permiso)) return res.status(403).json({ error: 'No tienes autorización para esta acción.' });
    next();
  };
}

export function configurarAutenticacion({ pool, origin, produccion = false }) {
  const router = Router();
  const cookie = produccion ? '__Host-sice_session' : 'sice_session';
  const opciones = opcionesCookie(produccion);
  const limpiar = (res) => res.clearCookie(cookie, opciones);

  // Revalida la sesión en MariaDB en cada petición antes de entregar el usuario a las rutas.
  async function exigirSesion(req, res, next) {
    if (!pool) return res.status(503).json({ error: 'El servicio de acceso no está disponible.' });
    const token = leerToken(req, cookie);
    const usuario = token ? await buscarSesion(pool, token) : null;
    if (!usuario || !roles.includes(usuario.rol)) {
      limpiar(res);
      return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    }
    req.usuario = usuario;
    req.tokenSesion = token;
    next();
  }

  router.use((req, res, next) => {
    if (!pool) return res.status(503).json({ error: 'El servicio de acceso no está disponible.' });
    next();
  });
  router.use(protegerSolicitudes({ origin, produccion }));

  // Comprueba el acceso y guarda sesión y auditoría en una transacción; los rechazos no identifican cuentas.
  router.post('/login', async (req, res) => {
    const { usuario, contrasena } = req.body || {};
    if (typeof usuario !== 'string' || !/^[a-zA-Z0-9._-]{3,60}$/.test(usuario)
        || typeof contrasena !== 'string' || !contrasena.length || Buffer.byteLength(contrasena) > 256) {
      return res.status(400).json({ error: 'Introduce un usuario y una contraseña válidos.' });
    }
    if (!await limitarIntentos(pool, req.ip, usuario)) {
      res.set('Retry-After', '900');
      return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' });
    }
    const cuenta = await buscarUsuario(pool, usuario);
    const valida = await verificarHash(contrasena, cuenta?.contrasena_hash);
    if (!valida || !cuenta.activo || !cuenta.persona_activa || !cuenta.es_personal || !roles.includes(cuenta.rol)) {
      if (cuenta) await registrarAcceso(pool, cuenta, 'acceso_rechazado');
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      const actual = await buscarUsuario(conexion, usuario, true);
      if (!actual || !actual.activo || !actual.persona_activa || !actual.es_personal
          || actual.contrasena_hash !== cuenta.contrasena_hash || !roles.includes(actual.rol)) {
        await conexion.rollback();
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      }
      const token = randomBytes(32).toString('hex');
      await guardarSesion(conexion, actual, token, leerToken(req, cookie));
      const datos = usuarioPublico(await cargarPermisos(conexion, actual));
      await conexion.commit();
      res.cookie(cookie, token, { ...opciones, maxAge: 8 * 60 * 60 * 1000 });
      res.json({ usuario: datos });
    } catch (error) { await conexion.rollback(); throw error; }
    finally { conexion.release(); }
  });

  router.get('/sesion', exigirSesion, autorizar('sesion.consultar'), (req, res) => {
    res.json({ usuario: usuarioPublico(req.usuario), entorno: produccion ? 'produccion' : 'desarrollo' });
  });

  // Revoca la sesión persistida y elimina la cookie del navegador.
  router.post('/logout', exigirSesion, async (req, res) => {
    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      await borrarSesion(conexion, req.tokenSesion, req.usuario);
      await conexion.commit();
      limpiar(res);
      res.status(204).end();
    } catch (error) { await conexion.rollback(); throw error; }
    finally { conexion.release(); }
  });
  return { router, exigirSesion };
}
