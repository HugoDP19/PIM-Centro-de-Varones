// Reúne cuentas, personal y permisos necesarios para gestión, sin consultar expedientes escolares.
export async function catalogosCuentas(db) {
  const [usuarios] = await db.execute(`SELECT u.id, u.id_persona, u.id_rol, u.nombre_usuario, u.activo,
    CONCAT(p.nombres, ' ', p.apellidos) AS nombre, r.codigo AS rol FROM usuarios u
    JOIN personas p ON p.id = u.id_persona JOIN roles r ON r.id = u.id_rol
    WHERE p.es_personal = 1 ORDER BY p.apellidos`);
  const [personas] = await db.execute(`SELECT p.id, CONCAT(p.nombres, ' ', p.apellidos) AS nombre FROM personas p
    WHERE p.es_personal = 1 AND p.activo = 1
      AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id_persona = p.id) ORDER BY p.apellidos`);
  const [roles] = await db.execute('SELECT id, codigo, nombre FROM roles ORDER BY nombre');
  const [permisos] = await db.execute('SELECT id, codigo, descripcion FROM permisos ORDER BY codigo');
  return { usuarios, personas, roles, permisos };
}
export async function cuenta(db, id, bloquear = false) {
  const [[fila]] = await db.execute(`SELECT u.*, r.codigo AS rol, p.activo AS persona_activa, p.es_personal FROM usuarios u JOIN roles r ON r.id = u.id_rol JOIN personas p ON p.id = u.id_persona
    WHERE u.id = ?${bloquear ? ' FOR UPDATE' : ''}`, [id]);
  return fila;
}
export async function rol(db, id) {
  const [[fila]] = await db.execute('SELECT id, codigo FROM roles WHERE id = ?', [id]); return fila;
}
export async function permiso(db, id) {
  const [[fila]] = await db.execute('SELECT id, codigo FROM permisos WHERE id = ?', [id]); return fila;
}
export async function personalSinCuenta(db, id) {
  const [[fila]] = await db.execute(`SELECT p.id FROM personas p WHERE p.id = ? AND p.es_personal = 1 AND p.activo = 1
    AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id_persona = p.id) FOR UPDATE`, [id]); return fila;
}
export async function solicitudes(db) {
  const [filas] = await db.execute(`SELECT a.id, a.tipo, a.id_usuario_objetivo, a.id_persona, a.id_rol_objetivo,
    a.id_permiso, a.nombre_usuario, a.activo, a.motivo, a.autorizada_en, a.vence_en, a.ejecutada_en,
    ua.nombre_usuario AS autorizante, ue.nombre_usuario AS ejecutor, a.id_autorizante,
    a.id_solicitante, a.id_rol_solicitante, a.solicitada_en, a.estado, a.revision_doble,
    us.nombre_usuario AS solicitante, rs.codigo AS rol_solicitante,
    a.id_decisor_director, a.decision_director, a.fundamento_director, a.decidida_director_en,
    a.id_decisor_subdirector, a.decision_subdirector, a.fundamento_subdirector, a.decidida_subdirector_en,
    ud.nombre_usuario AS decisor_director, usd.nombre_usuario AS decisor_subdirector
    FROM autorizaciones_cuentas a LEFT JOIN usuarios ua ON ua.id = a.id_autorizante
    LEFT JOIN usuarios us ON us.id = a.id_solicitante LEFT JOIN roles rs ON rs.id = a.id_rol_solicitante
    LEFT JOIN usuarios ud ON ud.id = a.id_decisor_director LEFT JOIN usuarios usd ON usd.id = a.id_decisor_subdirector
    LEFT JOIN usuarios ue ON ue.id = a.id_ejecutor
    ORDER BY (a.estado = 'pendiente' AND a.vence_en > UTC_TIMESTAMP(6)) DESC, a.id DESC`); return filas;
}
export async function autorizacion(db, id) {
  const [[fila]] = await db.execute('SELECT * FROM autorizaciones_cuentas WHERE id = ? FOR UPDATE', [id]); return fila;
}
// Busca un cambio pendiente equivalente para reutilizarlo dentro del bloqueo de gestión.
export async function solicitudEquivalente(db, datos) {
  const campos = ['tipo', 'id_solicitante', 'id_rol_solicitante', 'id_usuario_objetivo', 'id_persona',
    'id_rol_objetivo', 'id_permiso', 'nombre_usuario', 'activo', 'huella_objetivo'];
  const [[fila]] = await db.execute(`SELECT id FROM autorizaciones_cuentas
    WHERE estado IN ('pendiente', 'aprobada') AND vence_en > UTC_TIMESTAMP(6)
      AND ${campos.map(campo => `${campo} <=> ?`).join(' AND ')} ORDER BY id DESC LIMIT 1`, campos.map(campo => datos[campo] ?? null));
  return fila;
}
export async function asignacion(db, idRol, idPermiso) {
  const [filas] = await db.execute('SELECT id_rol FROM roles_permisos WHERE id_rol = ? AND id_permiso = ?', [idRol, idPermiso]); return filas.length > 0;
}
// Actualiza únicamente campos definidos por el servidor y revoca las sesiones de la cuenta.
export async function cambiarCuenta(db, id, datos) {
  await db.execute(`UPDATE usuarios SET ${Object.keys(datos).map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...Object.values(datos), id]);
  await db.execute('DELETE FROM sesiones WHERE id_usuario = ?', [id]);
}
// Modifica la relación rol-permiso y revoca las sesiones afectadas por esa concesión.
export async function cambiarPermiso(db, idRol, idPermiso, conceder) {
  if (conceder) await db.execute('INSERT INTO roles_permisos (id_rol, id_permiso) VALUES (?, ?)', [idRol, idPermiso]);
  else await db.execute('DELETE FROM roles_permisos WHERE id_rol = ? AND id_permiso = ?', [idRol, idPermiso]);
  await db.execute('DELETE s FROM sesiones s JOIN usuarios u ON u.id = s.id_usuario WHERE u.id_rol = ?', [idRol]);
}
export async function marcarEjecutada(db, id, ejecutor) {
  await db.execute("UPDATE autorizaciones_cuentas SET id_ejecutor = ?, ejecutada_en = UTC_TIMESTAMP(6), estado = 'ejecutada' WHERE id = ?", [ejecutor, id]);
}

export async function bloquearGestion(db) {
  // Orden común para serializar decisiones y proteger la última cuenta de cada autoridad.
  await db.execute('SELECT id FROM roles ORDER BY id FOR UPDATE');
}

// Verifica el token y su credencial dentro de la transacción que ejecutará el cambio sensible.
export async function sesionVigente(db, token, idUsuario) {
  const [filas] = await db.execute(`SELECT s.id_usuario FROM sesiones s JOIN usuarios u ON u.id = s.id_usuario
    WHERE s.token_hash = CONVERT(SHA2(?, 256) USING ascii) COLLATE ascii_bin AND s.id_usuario = ? AND s.vence_en > UTC_TIMESTAMP(6)
      AND s.ultima_actividad_en > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 30 MINUTE)
      AND s.credencial_hash = CONVERT(SHA2(u.contrasena_hash, 256) USING ascii) COLLATE ascii_bin`, [token, idUsuario]);
  return filas.length === 1;
}

export async function limpiarIntentoReautenticacion(db, clave) {
  await db.execute('DELETE FROM intentos_acceso WHERE clave = ?', [clave]);
}

export async function actualizarSolicitud(db, id, datos) {
  await db.execute(`UPDATE autorizaciones_cuentas SET ${Object.keys(datos).map(campo => `${campo} = ?`).join(', ')} WHERE id = ?`, [...Object.values(datos), id]);
}

export async function activosDelRol(db, idRol) {
  const [[fila]] = await db.execute(`SELECT COUNT(*) AS cantidad FROM usuarios u JOIN personas p ON p.id = u.id_persona
    WHERE u.id_rol = ? AND u.activo = 1 AND p.activo = 1 AND p.es_personal = 1`, [idRol]);
  return Number(fila.cantidad);
}

// Consulta la evidencia de cambios de una cuenta, con sus actores y fechas.
export async function historialCuenta(db, id) {
  const [filas] = await db.execute(`SELECT h.accion, h.ocurrido_en, h.motivo, h.campo, h.valor_anterior, h.valor_nuevo,
    u.nombre_usuario AS actor FROM historial h LEFT JOIN usuarios u ON u.id = h.id_actor
    WHERE h.id_usuario_afectado = ? AND h.id_incidencia IS NULL ORDER BY h.id DESC LIMIT 200`, [id]);
  return filas;
}
