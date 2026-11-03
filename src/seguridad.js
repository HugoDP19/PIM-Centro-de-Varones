import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt);
const parametros = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
export const roles = ['director', 'subdirector', 'coordinador_tutoria', 'docente', 'auxiliar', 'administrador'];
const hashInexistente = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

export function resumir(valor) {
  return createHash('sha256').update(valor).digest('hex');
}

export async function crearHash(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length < 15 || Buffer.byteLength(contrasena) > 256) {
    throw new Error('La contraseña debe tener al menos 15 caracteres y como máximo 256 bytes.');
  }
  const sal = randomBytes(16).toString('hex');
  const clave = await derivar(contrasena, sal, 64, parametros);
  return `scrypt$131072$8$1$${sal}$${clave.toString('hex')}`;
}

export async function verificarHash(contrasena, guardado) {
  const valido = typeof guardado === 'string' && /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(guardado);
  const partes = (valido ? guardado : hashInexistente).split('$');
  const clave = await derivar(contrasena, partes[4], 64, parametros);
  return timingSafeEqual(clave, Buffer.from(partes[5], 'hex')) && valido;
}

// Límites no delegables; la concesión SQL sigue siendo necesaria.
const operativos = roles.filter((rol) => rol !== 'administrador');
export const limitesPermisos = {
  'sesion.consultar': roles,
  'cuentas.consultar': ['director', 'subdirector', 'administrador'],
  'cuentas.administrar': ['administrador'],
  'cuentas.autorizar': ['director', 'subdirector'],
  'incidencias.registrar': operativos,
  'incidencias.consultar': operativos,
  'incidencias.seguimiento': operativos,
  'incidencias.exportar': operativos,
  'incidencias.restringidas': ['director', 'subdirector']
};

export function tienePermiso(usuario, permiso) {
  return Boolean(limitesPermisos[permiso]?.includes(usuario.rol) && usuario.permisos.includes(permiso));
}

export function rechazar(status, mensaje) {
  throw Object.assign(new Error(mensaje), { status, publicMessage: mensaje });
}

export function permisosEfectivos(usuario) {
  return usuario.permisos.filter((permiso) => tienePermiso(usuario, permiso));
}
