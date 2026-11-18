import { tienePermiso } from './seguridad.js';

export function alcance(usuario) {
  const autoridad = ['director', 'subdirector'].includes(usuario.rol);
  const internos = ['director', 'subdirector', 'coordinador_tutoria'].includes(usuario.rol);
  const reserva = autoridad && tienePermiso(usuario, 'incidencias.restringidas');
  return {
    sql: `NOT EXISTS (SELECT 1 FROM conflictos_interes c WHERE c.id_incidencia = i.id
      AND c.id_usuario_afectado = ? AND c.estado IN ('pendiente', 'inhibido'))
      AND ((i.estado = 'borrador' AND i.id_registrador = ?)
        OR (i.estado <> 'borrador' AND (? = 1 OR i.id_registrador = ?)
          AND (i.confidencialidad = 'interna' OR ? = 1)))`,
    valores: [usuario.id, usuario.id, Number(internos), usuario.id, Number(reserva)]
  };
}

export async function listarIncidencias(db, usuario, { buscar = '', pagina = 1 } = {}) {
  const filtro = alcance(usuario);
  const origen = `FROM incidencias i JOIN versiones_incidencia v ON v.id = i.id_version_vigente
    JOIN tipos_incidencia t ON t.id = v.id_tipo WHERE ${filtro.sql} AND v.titulo LIKE ?`;
  const parametros = [...filtro.valores, `%${buscar}%`];
  const [[conteo]] = await db.execute(`SELECT COUNT(*) AS total ${origen}`, parametros);
  const total = Number(conteo.total), porPagina = 25;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  pagina = Math.min(pagina, paginas);
  const desplazamiento = (pagina - 1) * porPagina;
  const [filas] = await db.execute(`
    SELECT i.id, i.estado, i.prioridad, i.confidencialidad, i.registrada_en, v.titulo, t.categoria,
           i.nombre_registrador ${origen} ORDER BY i.registrada_en DESC, i.id DESC LIMIT 25 OFFSET ?`,
  [...parametros, String(desplazamiento)]);
  return { incidencias: filas, paginacion: { pagina, paginas, porPagina, total,
    desde: total ? desplazamiento + 1 : 0, hasta: desplazamiento + filas.length } };
}

export async function buscarIncidencia(db, usuario, id, bloquear = false) {
  const filtro = alcance(usuario);
  const [filas] = await db.execute(`SELECT i.*, r.nombre AS cargo_registrador FROM incidencias i
    JOIN roles r ON r.id = i.id_rol_registrador
    WHERE i.id = ? AND ${filtro.sql}${bloquear ? ' FOR UPDATE' : ''}`, [id, ...filtro.valores]);
  return filas[0];
}

export async function versionActual(db, incidencia) {
  const [[version]] = await db.execute(`SELECT v.*, t.categoria, t.nombre AS tipo, t.minimo_estudiantes
    FROM versiones_incidencia v JOIN tipos_incidencia t ON t.id = v.id_tipo WHERE v.id = ?`, [incidencia.id_version_vigente]);
  return version;
}

export async function catalogos(db, usuario) {
  const reserva = tienePermiso(usuario, 'incidencias.restringidas');
  const [tipos] = await db.execute('SELECT id, categoria, nombre, minimo_estudiantes FROM tipos_incidencia WHERE activo = 1 ORDER BY categoria, nombre');
  const [personas] = await db.execute(`
    SELECT p.id, p.nombres, p.apellidos, p.es_personal,
      EXISTS(SELECT 1 FROM estudiantes e WHERE e.id_persona = p.id) AS es_estudiante,
      EXISTS(SELECT 1 FROM estudiantes_apoderados a WHERE a.id_apoderado = p.id) AS es_apoderado
    FROM personas p WHERE p.activo = 1
      AND (? = 1 OR p.id = ? OR NOT EXISTS (
        SELECT 1 FROM incidencias i JOIN versiones_incidencia v ON v.id_incidencia = i.id
        LEFT JOIN involucrados inv ON inv.id_version = v.id AND inv.id_persona = p.id
        WHERE i.confidencialidad = 'restringida' AND (i.estado <> 'borrador' OR i.id_registrador <> ?)
          AND (v.id_reportante = p.id OR inv.id_persona IS NOT NULL)))
    ORDER BY p.apellidos, p.nombres LIMIT 250`, [Number(reserva), usuario.id_persona, usuario.id]);
  const ids = new Set(personas.map((p) => String(p.id)));
  const [matriculas] = await db.execute(`SELECT m.id, m.id_estudiante AS id_persona, m.fecha_inicio, m.fecha_fin,
    a.anio_lectivo, a.nivel, a.grado, a.seccion FROM matriculas m JOIN aulas a ON a.id = m.id_aula ORDER BY a.anio_lectivo DESC`);
  const [aulas] = await db.execute('SELECT DISTINCT nivel, grado, seccion FROM aulas ORDER BY nivel, grado, seccion');
  return { tipos, personas, aulas, matriculas: matriculas.filter((m) => ids.has(String(m.id_persona))) };
}

export async function persona(db, id) {
  const [[fila]] = await db.execute(`SELECT p.*, EXISTS(SELECT 1 FROM estudiantes e WHERE e.id_persona = p.id AND e.activo = 1) AS es_estudiante,
    EXISTS(SELECT 1 FROM estudiantes_apoderados a WHERE a.id_apoderado = p.id) AS es_apoderado FROM personas p WHERE p.id = ?`, [id]);
  return fila;
}

export async function detalleIncidencia(db, incidencia) {
  const version = await versionActual(db, incidencia);
  const [involucrados] = await db.execute(`SELECT inv.*, CONCAT(p.nombres, ' ', p.apellidos) AS nombre,
    a.nivel, a.grado, a.seccion, a.anio_lectivo,
    EXISTS(SELECT 1 FROM estudiantes e WHERE e.id_persona = p.id) AS es_estudiante
    FROM involucrados inv JOIN personas p ON p.id = inv.id_persona
    LEFT JOIN matriculas m ON m.id = inv.id_matricula LEFT JOIN aulas a ON a.id = m.id_aula
    WHERE inv.id_version = ? ORDER BY p.apellidos, p.nombres`, [version.id]);
  const [actuaciones] = await db.execute(`SELECT a.*, CONCAT(p.nombres, ' ', p.apellidos) AS autor,
    r.nombre AS cargo_autor, CONCAT(pr.nombres, ' ', pr.apellidos) AS responsable
    FROM actuaciones a JOIN usuarios u ON u.id = a.id_autor JOIN personas p ON p.id = u.id_persona
    JOIN roles r ON r.id = a.id_rol_autor LEFT JOIN usuarios ur ON ur.id = a.id_responsable
    LEFT JOIN personas pr ON pr.id = ur.id_persona WHERE a.id_incidencia = ? ORDER BY a.registrada_en, a.id`, [incidencia.id]);
  const [historial] = await db.execute(`SELECT h.id, h.ocurrido_en, h.accion, h.campo, h.valor_anterior, h.valor_nuevo,
    h.motivo, CONCAT(p.nombres, ' ', p.apellidos) AS actor, r.nombre AS cargo
    FROM historial h JOIN usuarios u ON u.id = h.id_actor JOIN personas p ON p.id = u.id_persona
    JOIN roles r ON r.id = h.id_rol_actor WHERE h.id_incidencia = ? ORDER BY h.ocurrido_en, h.id`, [incidencia.id]);
  const [versiones] = await db.execute('SELECT id, numero_version, estado_version, creada_en, titulo, descripcion, lugar, nombre_reportante FROM versiones_incidencia WHERE id_incidencia = ? ORDER BY numero_version', [incidencia.id]);
  const [solicitudes] = await db.execute(`SELECT s.id, s.tipo, s.estado, s.justificacion, s.fundamento_decision,
    s.creada_en, s.decidida_en, ps.nombres AS solicitante, pd.nombres AS decisor FROM solicitudes_cambio s
    JOIN usuarios us ON us.id = s.id_solicitante JOIN personas ps ON ps.id = us.id_persona
    LEFT JOIN usuarios ud ON ud.id = s.id_decisor LEFT JOIN personas pd ON pd.id = ud.id_persona WHERE s.id_incidencia = ?`, [incidencia.id]);
  const [responsables] = await db.execute(`SELECT u.id, r.codigo AS rol, CONCAT(p.nombres, ' ', p.apellidos) AS nombre
    FROM usuarios u JOIN personas p ON p.id = u.id_persona JOIN roles r ON r.id = u.id_rol
    WHERE u.activo = 1 AND p.activo = 1
      AND (r.codigo IN ('director', 'subdirector') OR (? = 'interna' AND (r.codigo = 'coordinador_tutoria' OR u.id = ?)))
      AND EXISTS (SELECT 1 FROM roles_permisos rp JOIN permisos pe ON pe.id = rp.id_permiso
        WHERE rp.id_rol = u.id_rol AND pe.codigo = 'incidencias.seguimiento')
      AND NOT EXISTS (SELECT 1 FROM conflictos_interes c WHERE c.id_incidencia = ? AND c.id_usuario_afectado = u.id AND c.estado IN ('pendiente', 'inhibido'))
    ORDER BY p.apellidos`, [incidencia.confidencialidad, incidencia.id_registrador, incidencia.id]);
  return { incidencia, version, involucrados, actuaciones, historial, versiones, solicitudes, responsables };
}

export async function auditar(db, usuario, incidencia, accion, datos = {}) {
  const campos = { id_actor: usuario.id, id_rol_actor: usuario.id_rol, id_incidencia: incidencia,
    ocurrido_en: new Date(), accion, ...datos };
  await insertar(db, 'historial', campos);
}

// Nombres internos, nunca identificadores recibidos del cliente.
export async function insertar(db, tabla, datos) {
  const columnas = Object.keys(datos);
  const [resultado] = await db.execute(`INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`, Object.values(datos));
  return String(resultado.insertId);
}

export async function editarVersion(db, id, datos) {
  await db.execute(`UPDATE versiones_incidencia SET ${Object.keys(datos).map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...Object.values(datos), id]);
}

export async function reemplazarInvolucrados(db, version, involucrados) {
  await db.execute('DELETE FROM involucrados WHERE id_version = ?', [version]);
  for (const fila of involucrados) await insertar(db, 'involucrados', { id_version: version, ...fila });
}

export async function fijarEstado(db, id, datos) {
  await db.execute(`UPDATE incidencias SET ${Object.keys(datos).map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...Object.values(datos), id]);
}

export async function tipoIncidencia(db, id) {
  const [[fila]] = await db.execute('SELECT * FROM tipos_incidencia WHERE id = ? AND activo = 1', [id]);
  return fila;
}

export async function matricula(db, id) {
  const [[fila]] = await db.execute('SELECT * FROM matriculas WHERE id = ?', [id]);
  return fila;
}

export async function actuacionDelCaso(db, id, incidencia) {
  const [[fila]] = await db.execute('SELECT id FROM actuaciones WHERE id = ? AND id_incidencia = ?', [id, incidencia]);
  return fila;
}

export async function responsableDelCaso(db, id, incidencia) {
  const [[fila]] = await db.execute(`SELECT u.id, r.codigo AS rol FROM usuarios u JOIN personas p ON p.id = u.id_persona
    JOIN roles r ON r.id = u.id_rol WHERE u.id = ? AND u.activo = 1 AND p.activo = 1
    AND EXISTS (SELECT 1 FROM roles_permisos rp JOIN permisos pe ON pe.id = rp.id_permiso WHERE rp.id_rol = u.id_rol AND pe.codigo = 'incidencias.seguimiento')
    AND EXISTS (SELECT 1 FROM roles_permisos rp JOIN permisos pe ON pe.id = rp.id_permiso WHERE rp.id_rol = u.id_rol AND pe.codigo = 'incidencias.consultar')
    AND r.codigo <> 'administrador' AND NOT EXISTS (SELECT 1 FROM conflictos_interes c
      WHERE c.id_incidencia = ? AND c.id_usuario_afectado = u.id AND c.estado IN ('pendiente', 'inhibido'))`, [id, incidencia.id]);
  if (!fila) return null;
  if (incidencia.confidencialidad === 'restringida') {
    const [[permiso]] = await db.execute(`SELECT rp.id_rol FROM roles_permisos rp JOIN permisos p ON p.id = rp.id_permiso
      JOIN usuarios u ON u.id_rol = rp.id_rol WHERE u.id = ? AND p.codigo = 'incidencias.restringidas'`, [id]);
    return ['director', 'subdirector'].includes(fila.rol) && permiso ? fila : null;
  }
  return ['director', 'subdirector', 'coordinador_tutoria'].includes(fila.rol) || String(fila.id) === String(incidencia.id_registrador) ? fila : null;
}
