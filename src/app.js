import express from 'express';
import { fileURLToPath } from 'node:url';
import { configurarAutenticacion } from './autenticacion.js';

const directory = (relative) => fileURLToPath(new URL(relative, import.meta.url));

export function createApp({ pool, origin = 'http://127.0.0.1:3000', produccion = false, proxyLocal = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (proxyLocal) app.set('trust proxy', 'loopback');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '8kb' }));
  const auth = configurarAutenticacion({ pool, origin, produccion });
  app.use('/api/auth', auth.router);
  // Ninguna operación de expedientes está habilitada en la fase de autenticación.
  app.use('/api/incidencias', auth.exigirSesion, (_req, res) => {
    res.status(403).json({ error: 'La gestión de expedientes no está habilitada en esta fase.' });
  });

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', service: 'sice-local' });
  });
  app.use('/image', express.static(directory('../image/'), { index: false }));
  app.get('/vendor/bootstrap.min.css', (_req, res) => {
    res.sendFile(directory('../node_modules/bootstrap/dist/css/bootstrap.min.css'));
  });
  app.use(express.static(directory('../public/')));
  app.use((_req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const mensajes = { 400: 'La solicitud no es válida.', 404: 'Recurso no encontrado.', 413: 'La solicitud supera el tamaño permitido.' };
    const status = mensajes[error.status] ? error.status : 500;
    res.status(status).json({ error: mensajes[status] || 'No se pudo completar la solicitud. Inténtalo de nuevo.' });
  });
  return app;
}
export default createApp();
