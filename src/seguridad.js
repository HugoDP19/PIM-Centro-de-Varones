import { randomBytes, randomInt, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt);
const parametros = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
export const roles = ['director', 'subdirector', 'coordinador_tutoria', 'docente', 'auxiliar', 'administrador'];
const hashInexistente = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

// Resume tokens e identificadores técnicos con SHA-256.
export function resumir(valor) {
  return createHash('sha256').update(valor).digest('hex');
}

export function contrasenaValida(contrasena) {
  return typeof contrasena === 'string' && contrasena.length >= 8 && contrasena.length <= 12
    && /[A-Z]/.test(contrasena) && /[a-z]/.test(contrasena) && /[0-9]/.test(contrasena)
    && /[^A-Za-z0-9\s]/.test(contrasena);
}

// Usa aleatoriedad criptográfica y repite hasta cumplir la política de contraseña.
export function generarContrasena() {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*?';
  let contrasena;
  do {
    contrasena = Array.from({ length: 12 }, () => caracteres[randomInt(caracteres.length)]).join('');
  } while (!contrasenaValida(contrasena));
  return contrasena;
}

// Deriva la credencial con scrypt y una sal nueva; guarda los parámetros junto con el resultado.
export async function crearHash(contrasena) {
  if (!contrasenaValida(contrasena)) {
    rechazar(400, 'La contraseña debe tener entre 8 y 12 caracteres, con mayúscula, minúscula, número y signo.');
  }
  const sal = randomBytes(16).toString('hex');
  const clave = await derivar(contrasena, sal, 64, parametros);
  return `scrypt$131072$8$1$${sal}$${clave.toString('hex')}`;
}

// Deriva incluso ante un formato inválido y compara los resultados en tiempo constante.
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
  'cuentas.solicitar': ['director', 'subdirector', 'administrador'],
  'cuentas.ejecutar': ['director', 'subdirector', 'administrador'],
  'incidencias.registrar': operativos,
  'incidencias.consultar': operativos,
  'incidencias.seguimiento': operativos,
  'incidencias.solicitar': operativos,
  'incidencias.resolver': ['director', 'subdirector'],
  'incidencias.cerrar': ['director', 'subdirector', 'coordinador_tutoria'],
  'estudiantes.crear': ['director', 'subdirector', 'coordinador_tutoria'],
  'incidencias.exportar': operativos,
  'incidencias.restringidas': ['director', 'subdirector']
};

export function tienePermiso(usuario, permiso) {
  return Boolean(limitesPermisos[permiso]?.includes(usuario.rol) && usuario.permisos.includes(permiso));
}

export function rechazar(status, mensaje) {
  throw Object.assign(new Error(mensaje), { status, publicMessage: mensaje });
}

// Validación común sin depender de rutas, consultas ni generación de PDF.
export function validarIdentificador(valor) {
  const identificador = String(valor ?? '');
  if (!/^[1-9]\d{0,19}$/.test(identificador) || BigInt(identificador) > 9223372036854775807n) {
    rechazar(400, 'Identificador no válido.');
  }
  return identificador;
}

export function validarTexto(valor, campo, maximo, obligatorio = true) {
  if (typeof valor !== 'string' || valor.trim().length > maximo || (obligatorio && !valor.trim())) {
    rechazar(400, `Revisa el campo ${campo}.`);
  }
  return valor.trim();
}

// Admite nombres Unicode y separadores naturales, sin aceptar números o símbolos aislados.
export function validarNombre(valor, campo, maximo) {
  const nombre = validarTexto(valor, campo, maximo).normalize('NFC').replace(/\s+/g, ' ');
  if (!/^\p{L}[\p{L}\p{M}]*(?:[ '’ʼ-]\p{L}[\p{L}\p{M}]*)*$/u.test(nombre)) {
    rechazar(400, `Revisa ${campo}: usa letras, espacios, apóstrofes o guiones entre nombres.`);
  }
  return nombre;
}

export const escaparBusqueda = valor => valor.replace(/[!%_\[]/g, '!$&');

// La huella no depende del orden de las propiedades JSON de un reintento.
export function huellaRegistro(valor) {
  const ordenar = dato => Array.isArray(dato) ? dato.map(ordenar)
    : dato && typeof dato === 'object' ? Object.fromEntries(Object.keys(dato).sort().map(clave => [clave, ordenar(dato[clave])])) : dato;
  return resumir(JSON.stringify(ordenar(valor)));
}

export function permisosEfectivos(usuario) {
  return usuario.permisos.filter((permiso) => tienePermiso(usuario, permiso));
}
