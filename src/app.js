import express from 'express';
import { fileURLToPath } from 'node:url';

const app = express();
const directory = (relative) => fileURLToPath(new URL(relative, import.meta.url));

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
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
  const status = error.status === 404 ? 404 : 500;
  res.status(status).json({ error: status === 404 ? 'Recurso no encontrado.' : 'Error interno del servidor.' });
});

export default app;
