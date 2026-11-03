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

// Lista cerrada de permisos que esta fase puede reconocer. No habilita módulos futuros.
const limites = {
  'sesion.consultar': roles,
  'cuentas.administrar': ['administrador'],
  'cuentas.autorizar': ['director', 'subdirector']
};

export function tienePermiso(usuario, permiso) {
  return Boolean(limites[permiso]?.includes(usuario.rol) && usuario.permisos.includes(permiso));
}

export function permisosEfectivos(usuario) {
  return usuario.permisos.filter((permiso) => tienePermiso(usuario, permiso));
}
