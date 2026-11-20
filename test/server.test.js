import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import app, { createApp } from '../src/app.js';
import { createDatabasePool } from '../src/database.js';

test('servidor, portada y recursos locales', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'sice-local' });
  assert.equal(health.headers.get('x-powered-by'), null);
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete\./);
  for (const path of ['/image/images.jpg', '/vendor/bootstrap.min.css', '/css/styles.css', '/js/main.js']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    await response.arrayBuffer();
  }
  for (const path of ['/missing', '/.env', '/src/database.js', '/package.json']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
    await response.text();
  }
});

test('MySQL exige configuración real y puerto válido', () => {
  assert.throws(() => createDatabasePool({}), /DB_HOST, DB_NAME, DB_USER, DB_PASSWORD/);
  assert.throws(() => createDatabasePool({ DB_HOST: 'test', DB_NAME: 'test', DB_USER: 'test', DB_PASSWORD: 'test', DB_PORT: 'invalid' }), /DB_PORT/);
});

test('navegación local usa el origen configurado sin redirigir API ni dominios externos', async () => {
  for (const [origin, alias, produccion] of [
    ['http://127.0.0.1:3000', 'localhost:3000', false],
    ['http://localhost:3000', '127.0.0.1:3000', false],
    ['https://sice.example', 'localhost:3000', true]
  ]) {
    const server = createApp({ origin, produccion }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const solicitar = (ruta, host, method = 'GET') => new Promise((resolve, reject) => {
      const peticion = request(base + ruta, { method, headers: { Host: host } }, (response) => {
        response.resume();
        response.on('end', () => resolve(response));
      });
      peticion.on('error', reject);
      peticion.end();
    });
    try {
      for (const ruta of ['/', '/index.html', '/panel.html']) {
        const response = await solicitar(`${ruta}?sesion=cerrada`, alias);
        assert.equal(response.statusCode, produccion ? 200 : 302);
        assert.equal(response.headers.location, produccion ? undefined : `${origin}${ruta}?sesion=cerrada`);
      }
      for (const host of ['otro.example:3000', 'localhost:4000']) {
        const response = await solicitar('/', host);
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers.location, undefined);
      }
      const api = await solicitar('/api/auth/login', alias, 'POST');
      assert.equal(api.statusCode, 503);
      assert.equal(api.headers.location, undefined);
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
});
