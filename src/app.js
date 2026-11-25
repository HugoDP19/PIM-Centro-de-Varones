import express from 'express';
import { fileURLToPath } from 'node:url';
import { configurarAutenticacion, protegerSolicitudes } from './autenticacion.js';
import { rutasIncidencias } from './incidencias.js';
import { rutasCuentas } from './cuentas.js';
import { rutasEstudiantes } from './estudiantes.js';

const directory = (relative) => fileURLToPath(new URL(relative, import.meta.url));

// Configura la aplicación sin abrir un puerto; el servidor y las pruebas la inician por separado.
export function createApp({ pool, origin = 'http://127.0.0.1:3000', produccion = false, proxyLocal = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (proxyLocal) app.set('trust proxy', 'loopback');
  // Aplica cabeceras de seguridad antes de servir páginas o responder a las API.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  // Un único origen local para las páginas; las API mantienen su validación CSRF.
  const direccion = new URL(origin);
  const aliasLocal = direccion.hostname === '127.0.0.1' ? 'localhost' : direccion.hostname === 'localhost' ? '127.0.0.1' : null;
  app.use((req, res, next) => {
    const hostAlternativo = aliasLocal + (direccion.port ? `:${direccion.port}` : '');
    if (!produccion && aliasLocal && ['GET', 'HEAD'].includes(req.method)
        && ['/', '/index.html', '/panel.html'].includes(req.path)
        && req.get('host')?.toLowerCase() === hostAlternativo) {
      res.set('Cache-Control', 'no-store');
      return res.redirect(302, origin + req.originalUrl);
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  const auth = configurarAutenticacion({ pool, origin, produccion });
  app.use('/api/auth', auth.router);
  // Las rutas de gestión exigen sesión y origen válido, y permanecen bloqueadas en producción.
  const soloDesarrollo = (_req, res, next) => produccion || process.env.NODE_ENV !== 'development'
    ? res.status(503).json({ error: 'Este módulo requiere validación institucional antes de habilitarse en producción.' }) : next();
  app.use('/api/incidencias', protegerSolicitudes({ origin, produccion }), auth.exigirSesion, soloDesarrollo, rutasIncidencias(pool));
  app.use('/api/cuentas', protegerSolicitudes({ origin, produccion }), auth.exigirSesion, soloDesarrollo, rutasCuentas(pool));
  app.use('/api/estudiantes', protegerSolicitudes({ origin, produccion }), auth.exigirSesion, soloDesarrollo, rutasEstudiantes(pool));

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', service: 'sice-local' });
  });
  // Sirve únicamente los recursos públicos y el logo, sin exponer el código del servidor.
  app.use('/image', express.static(directory('../image/'), { index: false }));
  app.get('/vendor/bootstrap.min.css', (_req, res) => {
    res.sendFile(directory('../node_modules/bootstrap/dist/css/bootstrap.min.css'));
  });
  app.use(express.static(directory('../public/')));
  app.use((_req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));
  // Traduce los errores a respuestas públicas sin filtrar detalles del controlador SQL.
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const mensajes = { 400: 'La solicitud no es válida.', 401: 'Inicia sesión para continuar.', 403: 'Acceso no autorizado.',
      404: 'Recurso no encontrado.', 405: 'Operación no disponible.', 409: 'El registro cambió; revisa su estado.', 413: 'La solicitud supera el tamaño permitido.',
      429: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' };
    const status = [2601, 2627].includes(error.number) ? 409 : mensajes[error.status] ? error.status : 500;
    const mensaje = [2601, 2627].includes(error.number) ? 'Esa identificación ya está registrada. Revisa los datos autorizados.'
      : error.publicMessage && mensajes[status] ? error.publicMessage : mensajes[status] || 'No se pudo completar la solicitud. Inténtalo de nuevo.';
    if (status === 429) res.set('Retry-After', '900');
    res.status(status).json({ error: mensaje });
  });
  return app;
}
