export async function catalogosCuentas(db) {
  const [usuarios] = await db.execute(`SELECT u.id, u.id_persona, u.id_rol, u.nombre_usuario, u.activo,
    CONCAT(p.nombres, ' ', p.apellidos) AS nombre, r.codigo AS rol FROM usuarios u
    JOIN personas p ON p.id = u.id_persona JOIN roles r ON r.id = u.id_rol
    WHERE p.es_personal = 1 AND p.codigo_interno NOT LIKE 'DEMO-%' ORDER BY p.apellidos`);
  const [personas] = await db.execute(`SELECT p.id, CONCAT(p.nombres, ' ', p.apellidos) AS nombre FROM personas p
    WHERE p.es_personal = 1 AND p.activo = 1 AND p.codigo_interno NOT LIKE 'DEMO-%'
      AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id_persona = p.id) ORDER BY p.apellidos`);
  const [roles] = await db.execute('SELECT id, codigo, nombre FROM roles ORDER BY nombre');
  const [permisos] = await db.execute('SELECT id, codigo, descripcion FROM permisos ORDER BY codigo');
  return { usuarios, personas, roles, permisos };
}
export async function cuenta(db, id, bloquear = false) {
  const [[fila]] = await db.execute(`SELECT u.*, r.codigo AS rol, p.activo AS persona_activa FROM usuarios u JOIN roles r ON r.id = u.id_rol JOIN personas p ON p.id = u.id_persona
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
    ua.nombre_usuario AS autorizante, ue.nombre_usuario AS ejecutor, a.id_autorizante
    FROM autorizaciones_cuentas a JOIN usuarios ua ON ua.id = a.id_autorizante
    LEFT JOIN usuarios ue ON ue.id = a.id_ejecutor ORDER BY a.id DESC LIMIT 100`); return filas;
}
export async function autorizacion(db, id) {
  const [[fila]] = await db.execute('SELECT * FROM autorizaciones_cuentas WHERE id = ? FOR UPDATE', [id]); return fila;
}
export async function asignacion(db, idRol, idPermiso) {
  const [filas] = await db.execute('SELECT id_rol FROM roles_permisos WHERE id_rol = ? AND id_permiso = ?', [idRol, idPermiso]); return filas.length > 0;
}
export async function cambiarCuenta(db, id, datos) {
  await db.execute(`UPDATE usuarios SET ${Object.keys(datos).map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...Object.values(datos), id]);
  await db.execute('DELETE FROM sesiones WHERE id_usuario = ?', [id]);
}
export async function cambiarPermiso(db, idRol, idPermiso, conceder) {
  if (conceder) await db.execute('INSERT INTO roles_permisos (id_rol, id_permiso) VALUES (?, ?)', [idRol, idPermiso]);
  else await db.execute('DELETE FROM roles_permisos WHERE id_rol = ? AND id_permiso = ?', [idRol, idPermiso]);
}
export async function marcarEjecutada(db, id, ejecutor) {
  await db.execute('UPDATE autorizaciones_cuentas SET id_ejecutor = ?, ejecutada_en = UTC_TIMESTAMP(6) WHERE id = ?', [ejecutor, id]);
}
