import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { crearHash, verificarHash, generarContrasena, contrasenaValida, roles, tienePermiso, permisosEfectivos } from '../src/seguridad.js';
import { opcionesCookie } from '../src/autenticacion.js';

test('scrypt: sal independiente, verificación y rechazo de hashes inválidos', async () => {
  const clave = generarContrasena();
  const primero = await crearHash(clave);
  const segundo = await crearHash(clave);
  assert.ok(primero !== segundo);
  assert.ok(!primero.includes(clave));
  assert.equal(await verificarHash(clave, primero), true);
  assert.equal(await verificarHash(randomBytes(24).toString('hex'), primero), false);
  assert.equal(await verificarHash(clave, null), false);
  await assert.rejects(crearHash(''), /8 y 12 caracteres/);
});

test('contraseñas: límites de 8 y 12 caracteres y los cuatro tipos requeridos', async () => {
  for (const clave of ['Abc1!xyz', 'Abc1!xyz789A', generarContrasena()]) {
    assert.equal(contrasenaValida(clave), true);
  }
  for (const clave of [null, 123, '', 'Ab1!xyz', 'Abc1!xyz7890A', 'abcdef1!', 'ABCDEF1!', 'Abcdef!?', 'Abcdef12']) {
    assert.equal(contrasenaValida(clave), false);
    await assert.rejects(crearHash(clave), error => error.status === 400);
  }
});

test('los seis roles respetan límites aunque reciban permisos incompatibles', () => {
  for (const rol of roles) {
    const usuario = { rol, permisos: ['sesion.consultar', 'cuentas.administrar', 'cuentas.autorizar', 'incidencias.consultar', 'incidencias.modificar', 'incidencias.eliminar'] };
    assert.equal(tienePermiso(usuario, 'sesion.consultar'), true);
    assert.equal(tienePermiso(usuario, 'cuentas.administrar'), rol === 'administrador');
    assert.equal(tienePermiso(usuario, 'cuentas.autorizar'), ['director', 'subdirector'].includes(rol));
    assert.equal(tienePermiso(usuario, 'incidencias.consultar'), rol !== 'administrador');
    assert.ok(!permisosEfectivos(usuario).includes('incidencias.modificar'));
    assert.ok(!permisosEfectivos(usuario).includes('incidencias.eliminar'));
    assert.equal(tienePermiso({ rol, permisos: [] }, 'sesion.consultar'), false);
  }
  assert.equal(tienePermiso({ rol: 'desconocido', permisos: ['sesion.consultar'] }, 'sesion.consultar'), false);
});

test('cookies httpOnly y SameSite Strict; Secure en producción', () => {
  assert.deepEqual(opcionesCookie(true), { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
  assert.equal(opcionesCookie(false).secure, false);
});
