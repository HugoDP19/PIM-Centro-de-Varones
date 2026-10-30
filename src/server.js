import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un entero entre 1 y 65535.');
}
const server = app.listen(port, host, () => {
  console.log(`SICE-Local disponible en http://${host}:${port}`);
});
server.on('error', (error) => {
  console.error(`No se pudo iniciar el servidor (${error.code || 'ERROR'}).`);
  process.exitCode = 1;
});
