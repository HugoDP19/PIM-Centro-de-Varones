import { resumir } from './seguridad.js';

const seleccionUsuario = `
  SELECT u.id, u.id_persona, u.id_rol, u.nombre_usuario, u.contrasena_hash,
         u.activo, p.activo AS persona_activa, p.es_personal,
         CONCAT(p.nombres, ' ', p.apellidos) AS nombre, r.codigo AS rol
  FROM usuarios u JOIN personas p ON p.id = u.id_persona
  JOIN roles r ON r.id = u.id_rol`;

export async function buscarUsuario(db, nombre, bloquear = false) {
  const [filas] = await db.execute(`${seleccionUsuario} WHERE u.nombre_usuario = ?${bloquear ? ' FOR UPDATE' : ''}`, [nombre]);
  return filas[0];
}

// Obtiene las concesiones del rol actual; los límites institucionales se aplican además en el servidor.
export async function cargarPermisos(db, usuario) {
  const [filas] = await db.execute(`
    SELECT p.codigo FROM permisos p JOIN roles_permisos rp ON rp.id_permiso = p.id
    WHERE rp.id_rol = ? ORDER BY p.codigo`, [usuario.id_rol]);
  return { ...usuario, permisos: filas.map((fila) => fila.codigo) };
}

// Añade el evento de acceso al historial con el actor y rol que lo realizaron.
export async function registrarAcceso(db, usuario, accion) {
  await db.execute(`
    INSERT INTO historial (id_actor, id_rol_actor, ocurrido_en, accion, id_usuario_afectado)
    VALUES (?, ?, UTC_TIMESTAMP(6), ?, ?)`, [usuario.id, usuario.id_rol, accion, usuario.id]);
}

export async function limitarIntentos(db, ip, nombre) {
  // Persistencia y contador atómico: reiniciar Node no reinicia los límites.
  for (const [valor, limite] of [[`ip:${ip}`, 100], [`cuenta:${nombre.toLowerCase()}`, 10]]) {
    const clave = resumir(valor);
    await db.execute(`
      INSERT INTO intentos_acceso (clave, cantidad, vence_en)
      VALUES (?, 1, DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 15 MINUTE))
      ON DUPLICATE KEY UPDATE
        cantidad = IF(vence_en <= UTC_TIMESTAMP(6), 1, cantidad + 1),
        vence_en = IF(vence_en <= UTC_TIMESTAMP(6), DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 15 MINUTE), vence_en)`, [clave]);
    const [[fila]] = await db.execute('SELECT cantidad FROM intentos_acceso WHERE clave = ?', [clave]);
    if (fila.cantidad > limite) return false;
  }
  return true;
}

// Persiste solo resúmenes del token y la credencial, con fechas de actividad y vencimiento.
export async function guardarSesion(db, usuario, token, anterior) {
  if (anterior) await db.execute('DELETE FROM sesiones WHERE token_hash = ?', [resumir(anterior)]);
  await db.execute(`
    INSERT INTO sesiones (token_hash, id_usuario, credencial_hash, creada_en, ultima_actividad_en, vence_en)
    VALUES (?, ?, ?, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 8 HOUR))`,
  [resumir(token), usuario.id, resumir(usuario.contrasena_hash)]);
  await db.execute('DELETE FROM intentos_acceso WHERE clave = ?', [resumir(`cuenta:${usuario.nombre_usuario.toLowerCase()}`)]);
  await registrarAcceso(db, usuario, 'sesion_iniciada');
}

// Comprueba vencimiento, inactividad y credencial vigente para invalidar sesiones antiguas.
export async function buscarSesion(db, token) {
  const [filas] = await db.execute(`${seleccionUsuario}
    JOIN sesiones s ON s.id_usuario = u.id
    WHERE s.token_hash = ? AND s.vence_en > UTC_TIMESTAMP(6)
      AND s.ultima_actividad_en > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 30 MINUTE)
      AND s.credencial_hash = CONVERT(SHA2(u.contrasena_hash, 256) USING ascii) COLLATE ascii_bin
      AND u.activo = 1 AND p.activo = 1 AND p.es_personal = 1`, [resumir(token)]);
  if (!filas[0]) {
    await db.execute('DELETE FROM sesiones WHERE token_hash = ?', [resumir(token)]);
    return null;
  }
  await db.execute('UPDATE sesiones SET ultima_actividad_en = UTC_TIMESTAMP(6) WHERE token_hash = ?', [resumir(token)]);
  return cargarPermisos(db, filas[0]);
}

// Revoca el token concreto y deja evidencia del cierre de sesión.
export async function borrarSesion(db, token, usuario) {
  await db.execute('DELETE FROM sesiones WHERE token_hash = ?', [resumir(token)]);
  await registrarAcceso(db, usuario, 'sesion_cerrada');
}
