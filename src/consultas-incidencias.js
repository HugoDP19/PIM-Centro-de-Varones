import { tienePermiso, escaparBusqueda } from './seguridad.js';

// Filtra los expedientes por ámbito, confidencialidad y conflictos.
export function alcance(usuario) {
  const autoridad = ['director', 'subdirector'].includes(usuario.rol);
  const internos = ['director', 'subdirector', 'coordinador_tutoria'].includes(usuario.rol);
  const reserva = autoridad && tienePermiso(usuario, 'incidencias.restringidas');
  return {
    sql: `
      NOT EXISTS (
        SELECT 1
        FROM conflictos_interes c
        WHERE c.id_incidencia = i.id
          AND c.id_usuario_afectado = ?
          AND c.estado IN ('pendiente', 'inhibido')
      )
      AND (
        (
          i.estado = 'borrador'
          AND i.id_registrador = ?
        )
        OR (
          i.estado <> 'borrador'
          AND (
            ? = 1
            OR i.id_registrador = ?
          )
          AND (
            i.confidencialidad = 'interna'
            OR ? = 1
          )
        )
      )
    `,
    valores: [usuario.id, usuario.id, Number(internos), usuario.id, Number(reserva)]
  };
}

// Comparte el filtro entre conteo y resultados, siempre con valores parametrizados.
export async function listarIncidencias(
  db,
  usuario,
  { buscar = '', pagina = 1, codigo, desde, hasta, categoria = '', estado = '' } = {}
) {
  const filtro = alcance(usuario);
  const condiciones = [filtro.sql];
  const parametros = [...filtro.valores];
  if (codigo) {
    condiciones.push('i.id = ?');
    parametros.push(codigo);
  } else if (desde) {
    condiciones.push('v.ocurrida_en >= ? AND v.ocurrida_en < ?');
    parametros.push(desde, hasta);
  } else if (buscar) {
    const patron = `%${escaparBusqueda(buscar)}%`;
    // EXISTS busca estudiantes de la versión visible sin duplicar ni revelar otros casos.
    condiciones.push(`(v.titulo LIKE ? ESCAPE '!' OR EXISTS (
      SELECT 1 FROM involucrados inv JOIN estudiantes e ON e.id_persona = inv.id_persona
      JOIN personas p ON p.id = e.id_persona WHERE inv.id_version = v.id
        AND CONCAT(p.nombres, ' ', p.apellidos) LIKE ? ESCAPE '!'))`);
    parametros.push(patron, patron);
  }
  if (categoria) {
    condiciones.push('t.categoria = ?');
    parametros.push(categoria);
  }
  if (estado) {
    condiciones.push('i.estado = ?');
    parametros.push(estado);
  }
  const origen = `
    FROM incidencias i
      JOIN versiones_incidencia v ON v.id = i.id_version_vigente
      JOIN tipos_incidencia t ON t.id = v.id_tipo
    WHERE ${condiciones.join(' AND ')}
  `;
  const [[conteo]] = await db.execute(`SELECT COUNT(*) AS total ${origen}`, parametros);
  const total = Number(conteo.total);
  const porPagina = 20;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  pagina = Math.min(pagina, paginas);
  const desplazamiento = (pagina - 1) * porPagina;
  const [filas] = await db.execute(
    `
      SELECT i.id,
        i.estado,
        i.prioridad,
        i.confidencialidad,
        i.registrada_en,
        v.titulo,
        t.categoria,
        i.nombre_registrador ${origen}
      ORDER BY i.registrada_en DESC,
        i.id DESC
      OFFSET
        ? ROWS
      FETCH NEXT
        20 ROWS ONLY
    `,
    [...parametros, desplazamiento]
  );
  return {
    incidencias: filas,
    paginacion: {
      pagina,
      paginas,
      porPagina,
      total,
      desde: total ? desplazamiento + 1 : 0,
      hasta: desplazamiento + filas.length
    }
  };
}

export async function buscarIncidencia(db, usuario, id, bloquear = false) {
  const filtro = alcance(usuario);
  const [filas] = await db.execute(
    `
      SELECT i.*,
        r.nombre AS cargo_registrador
      FROM incidencias i ${bloquear ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
        JOIN roles r ON r.id = i.id_rol_registrador
      WHERE i.id = ?
        AND ${filtro.sql}
    `,
    [id, ...filtro.valores]
  );
  return filas[0];
}

export async function versionActual(db, incidencia) {
  const [[version]] = await db.execute(
    `
      SELECT v.*,
        t.categoria,
        t.nombre AS tipo,
        t.minimo_estudiantes
      FROM versiones_incidencia v
        JOIN tipos_incidencia t ON t.id = v.id_tipo
      WHERE v.id = ?
    `,
    [incidencia.id_version_vigente]
  );
  return version;
}

// Comparte la misma reserva entre búsqueda e identidad seleccionada, sin depender de una página.
function filtroPersonas(usuario) {
  return {
    sql: `
      p.activo = 1
      AND (
        ? = 1
        OR p.id = ?
        OR NOT EXISTS (
          SELECT 1
          FROM incidencias i
            JOIN versiones_incidencia v ON v.id_incidencia = i.id
            LEFT JOIN involucrados inv ON inv.id_version = v.id
            AND inv.id_persona = p.id
          WHERE i.confidencialidad = 'restringida'
            AND (
              i.estado <> 'borrador'
              OR i.id_registrador <> ?
            )
            AND (
              v.id_reportante = p.id
              OR inv.id_persona IS NOT NULL
            )
        )
      )
    `,
    valores: [
      Number(tienePermiso(usuario, 'incidencias.restringidas')),
      usuario.id_persona,
      usuario.id
    ]
  };
}

const identidadPersona = `
    p.id, p.nombres, p.apellidos, p.es_personal, CASE
    WHEN EXISTS(SELECT 1
    FROM estudiantes e
    WHERE e.id_persona = p.id
    AND e.activo = 1) THEN 1
    ELSE 0
    END AS es_estudiante, CASE
    WHEN EXISTS(SELECT 1
    FROM estudiantes_apoderados a
    WHERE a.id_apoderado = p.id) THEN 1
    ELSE 0
    END AS es_apoderado
  `;

export async function personaVisible(db, usuario, id) {
  const filtro = filtroPersonas(usuario);
  const [[fila]] = await db.execute(
    `SELECT ${identidadPersona} FROM personas p WHERE p.id = ? AND ${filtro.sql}`,
    [id, ...filtro.valores]
  );
  return fila;
}

export async function buscarPersonas(db, usuario, { buscar = '', pagina = 1, id } = {}) {
  const filtro = filtroPersonas(usuario);
  const condiciones = [filtro.sql];
  const valores = [...filtro.valores];
  if (id) {
    condiciones.push('p.id = ?');
    valores.push(id);
  }
  if (buscar) {
    condiciones.push(
      "(CONCAT(p.nombres, ' ', p.apellidos) LIKE ? ESCAPE '!' OR p.codigo_interno LIKE ? ESCAPE '!')"
    );
    valores.push(`%${escaparBusqueda(buscar)}%`, `%${escaparBusqueda(buscar)}%`);
  }
  const origen = `FROM personas p WHERE ${condiciones.join(' AND ')}`;
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total ${origen}`, valores);
  const porPagina = 50;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  pagina = Math.min(pagina, paginas);
  const [personas] = await db.execute(
    `
      SELECT ${identidadPersona} ${origen}
      ORDER BY p.apellidos,
        p.nombres,
        p.id
      OFFSET
        ? ROWS
      FETCH NEXT
        50 ROWS ONLY
    `,
    [...valores, (pagina - 1) * porPagina]
  );
  if (!personas.length) {
    return { personas, matriculas: [], paginacion: { pagina, paginas, total } };
  }
  const [matriculas] = await db.execute(
    `
      SELECT m.id,
        m.id_estudiante AS id_persona,
        m.fecha_inicio,
        m.fecha_fin,
        a.anio_lectivo,
        a.nivel,
        a.grado,
        a.seccion
      FROM matriculas m
        JOIN aulas a ON a.id = m.id_aula
      WHERE m.id_estudiante IN (${personas.map(() => '?').join(', ')})
      ORDER BY a.anio_lectivo DESC
    `,
    personas.map((p) => p.id)
  );
  return { personas, matriculas, paginacion: { pagina, paginas, total } };
}

export async function catalogos(db, usuario) {
  const [tipos] = await db.execute(
    `
      SELECT id,
        categoria,
        nombre,
        minimo_estudiantes
      FROM tipos_incidencia
      WHERE activo = 1
      ORDER BY categoria,
        nombre
    `
  );
  const [aulas] = await db.execute(
    'SELECT DISTINCT nivel, grado, seccion FROM aulas ORDER BY nivel, grado, seccion'
  );
  return { tipos, aulas, ...(await buscarPersonas(db, usuario)) };
}

export async function persona(db, id) {
  const [[fila]] = await db.execute(
    `
      SELECT p.*,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM estudiantes e
            WHERE e.id_persona = p.id
              AND e.activo = 1
          ) THEN 1
          ELSE 0
        END AS es_estudiante,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM estudiantes_apoderados a
            WHERE a.id_apoderado = p.id
          ) THEN 1
          ELSE 0
        END AS es_apoderado
      FROM personas p
      WHERE p.id = ?
    `,
    [id]
  );
  return fila;
}

// Reúne versión, participantes y evidencias del expediente cuya lectura ya fue autorizada.
export async function detalleIncidencia(db, incidencia) {
  const version = await versionActual(db, incidencia);
  const [involucrados] = await db.execute(
    `
      SELECT inv.*,
        CONCAT(p.nombres, ' ', p.apellidos) AS nombre,
        a.nivel,
        a.grado,
        a.seccion,
        a.anio_lectivo,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM estudiantes e
            WHERE e.id_persona = p.id
          ) THEN 1
          ELSE 0
        END AS es_estudiante
      FROM involucrados inv
        JOIN personas p ON p.id = inv.id_persona
        LEFT JOIN matriculas m ON m.id = inv.id_matricula
        LEFT JOIN aulas a ON a.id = m.id_aula
      WHERE inv.id_version = ?
      ORDER BY p.apellidos,
        p.nombres
    `,
    [version.id]
  );
  const [actuaciones] = await db.execute(
    `
      SELECT a.*,
        CONCAT(p.nombres, ' ', p.apellidos) AS autor,
        r.nombre AS cargo_autor,
        CASE
          WHEN pr.id IS NULL THEN NULL
          ELSE CONCAT(pr.nombres, ' ', pr.apellidos)
        END AS responsable
      FROM actuaciones a
        JOIN usuarios u ON u.id = a.id_autor
        JOIN personas p ON p.id = u.id_persona
        JOIN roles r ON r.id = a.id_rol_autor
        LEFT JOIN usuarios ur ON ur.id = a.id_responsable
        LEFT JOIN personas pr ON pr.id = ur.id_persona
      WHERE a.id_incidencia = ?
      ORDER BY a.registrada_en,
        a.id
    `,
    [incidencia.id]
  );
  const [historial] = await db.execute(
    `
      SELECT h.id,
        h.ocurrido_en,
        h.accion,
        CASE
          WHEN h.campo = 'operacion_registro' THEN NULL
          ELSE h.campo
        END AS campo,
        CASE
          WHEN h.campo = 'operacion_registro' THEN NULL
          ELSE h.valor_anterior
        END AS valor_anterior,
        CASE
          WHEN h.campo = 'operacion_registro' THEN NULL
          ELSE h.valor_nuevo
        END AS valor_nuevo,
        h.motivo,
        CONCAT(p.nombres, ' ', p.apellidos) AS actor,
        r.nombre AS cargo
      FROM historial h
        JOIN usuarios u ON u.id = h.id_actor
        JOIN personas p ON p.id = u.id_persona
        JOIN roles r ON r.id = h.id_rol_actor
      WHERE h.id_incidencia = ?
      ORDER BY h.ocurrido_en,
        h.id
    `,
    [incidencia.id]
  );
  const [versiones] = await db.execute(
    `
      SELECT id,
        numero_version,
        estado_version,
        creada_en,
        titulo,
        descripcion,
        lugar,
        nombre_reportante
      FROM versiones_incidencia
      WHERE id_incidencia = ?
      ORDER BY numero_version
    `,
    [incidencia.id]
  );
  const [solicitudes] = await db.execute(
    `
      SELECT s.*,
        ps.nombres AS solicitante,
        pd.nombres AS decisor,
        us.id_persona AS id_persona_solicitante,
        vp.titulo AS titulo_propuesto,
        vp.descripcion AS descripcion_propuesta,
        vp.lugar AS lugar_propuesto
      FROM solicitudes_cambio s
        JOIN usuarios us ON us.id = s.id_solicitante
        JOIN personas ps ON ps.id = us.id_persona
        LEFT JOIN usuarios ud ON ud.id = s.id_decisor
        LEFT JOIN personas pd ON pd.id = ud.id_persona
        LEFT JOIN versiones_incidencia vp ON vp.id = s.id_version_propuesta
      WHERE s.id_incidencia = ?
      ORDER BY s.id
    `,
    [incidencia.id]
  );
  const responsables = await responsablesDelCaso(db, incidencia);
  return {
    incidencia,
    version,
    involucrados,
    actuaciones,
    historial,
    versiones,
    solicitudes,
    responsables
  };
}

// Añade una evidencia con actor, rol y referencias; no reemplaza eventos anteriores.
export async function auditar(db, usuario, incidencia, accion, datos = {}) {
  const campos = {
    id_actor: usuario.id,
    id_rol_actor: usuario.id_rol,
    id_incidencia: incidencia,
    ocurrido_en: new Date(),
    accion,
    ...datos
  };
  await insertar(db, 'historial', campos);
}

// Nombres internos, nunca identificadores recibidos del cliente.
export async function insertar(db, tabla, datos) {
  const columnas = Object.keys(datos);
  const identidad = ![
    'estudiantes',
    'involucrados',
    'roles_permisos',
    'participantes_revision'
  ].includes(tabla);
  const parametros = columnas.map(() => '?').join(', ');
  const devolverId = identidad ? 'OUTPUT INSERTED.id' : '';
  const [filas] = await db.execute(
    `INSERT INTO ${tabla} (${columnas.join(', ')}) ${devolverId} VALUES (${parametros})`,
    Object.values(datos)
  );
  return identidad ? String(filas[0].id) : undefined;
}

export async function editarVersion(db, id, datos) {
  const asignaciones = Object.keys(datos)
    .map((campo) => `${campo} = ?`)
    .join(', ');
  await db.execute(`UPDATE versiones_incidencia SET ${asignaciones} WHERE id = ?`, [
    ...Object.values(datos),
    id
  ]);
}

// Añade participantes a una versión nueva sin borrar los de versiones anteriores.
export async function insertarInvolucrados(db, version, involucrados) {
  for (const fila of involucrados) {
    await insertar(db, 'involucrados', { id_version: version, ...fila });
  }
}

export async function fijarEstado(db, id, datos) {
  const asignaciones = Object.keys(datos)
    .map((campo) => `${campo} = ?`)
    .join(', ');
  await db.execute(`UPDATE incidencias SET ${asignaciones} WHERE id = ?`, [
    ...Object.values(datos),
    id
  ]);
}

export async function solicitudesPendientes(db, incidencia) {
  const [filas] = await db.execute(
    "SELECT id FROM solicitudes_cambio WHERE id_incidencia = ? AND estado = 'pendiente'",
    [incidencia]
  );
  return filas;
}

// Bloquea la solicitud del expediente para serializar su evaluación o resolución.
export async function solicitudCambio(db, id, incidencia) {
  const [[fila]] = await db.execute(
    `
        SELECT s.*,
          u.id_persona AS id_persona_solicitante
        FROM solicitudes_cambio s
        WITH (UPDLOCK, HOLDLOCK)
          JOIN usuarios u ON u.id = s.id_solicitante
        WHERE s.id = ?
          AND s.id_incidencia = ?
      `,
    [id, incidencia]
  );
  return fila;
}

export async function actualizarSolicitud(db, id, datos) {
  const asignaciones = Object.keys(datos)
    .map((campo) => `${campo} = ?`)
    .join(', ');
  await db.execute(`UPDATE solicitudes_cambio SET ${asignaciones} WHERE id = ?`, [
    ...Object.values(datos),
    id
  ]);
}

// El llamador mantiene bloqueado el expediente para asignar un número de versión sin colisiones.
export async function numeroVersion(db, incidencia) {
  const [[fila]] = await db.execute(
    `
      SELECT MAX(numero_version) AS numero
      FROM versiones_incidencia
      WHERE id_incidencia = ?
    `,
    [incidencia]
  );
  return Number(fila.numero) + 1;
}

export async function versionPorId(db, id) {
  const [[fila]] = await db.execute('SELECT * FROM versiones_incidencia WHERE id = ?', [id]);
  return fila;
}

export async function participantesVersion(db, id) {
  const [filas] = await db.execute(
    `
        SELECT id_persona,
          id_matricula,
          participacion
        FROM involucrados
        WHERE id_version = ?
        ORDER BY id_persona
      `,
    [id]
  );
  return filas;
}

export async function aulasActivas(db) {
  const [filas] = await db.execute(
    `
        SELECT id,
          anio_lectivo,
          nivel,
          grado,
          seccion
        FROM aulas
        WHERE activo = 1
        ORDER BY anio_lectivo DESC,
          nivel,
          grado,
          seccion
      `
  );
  return filas;
}

export async function tipoIncidencia(db, id) {
  const [[fila]] = await db.execute('SELECT * FROM tipos_incidencia WHERE id = ? AND activo = 1', [
    id
  ]);
  return fila;
}

export async function matricula(db, id) {
  const [[fila]] = await db.execute('SELECT * FROM matriculas WHERE id = ?', [id]);
  return fila;
}

export async function actuacionDelCaso(db, id, incidencia) {
  const [[fila]] = await db.execute(
    'SELECT id FROM actuaciones WHERE id = ? AND id_incidencia = ?',
    [id, incidencia]
  );
  return fila;
}

// Valida cuenta, permisos, ámbito y conflictos antes de asignar responsabilidad de seguimiento.
export async function responsableDelCaso(db, id, incidencia) {
  return (await responsablesDelCaso(db, incidencia, id))[0];
}

async function responsablesDelCaso(db, incidencia, id) {
  const [filas] = await db.execute(
    `
      SELECT u.id,
        r.codigo AS rol,
        CONCAT(p.nombres, ' ', p.apellidos) AS nombre
      FROM usuarios u
        JOIN personas p ON p.id = u.id_persona
        JOIN roles r ON r.id = u.id_rol
      WHERE u.activo = 1
        AND p.activo = 1
        AND p.es_personal = 1
        AND EXISTS (
          SELECT 1
          FROM roles_permisos rp
            JOIN permisos pe ON pe.id = rp.id_permiso
          WHERE rp.id_rol = u.id_rol
            AND pe.codigo = 'incidencias.seguimiento'
        )
        AND EXISTS (
          SELECT 1
          FROM roles_permisos rp
            JOIN permisos pe ON pe.id = rp.id_permiso
          WHERE rp.id_rol = u.id_rol
            AND pe.codigo = 'incidencias.consultar'
        )
        AND r.codigo <> 'administrador'
        AND NOT EXISTS (
          SELECT 1
          FROM conflictos_interes c
          WHERE c.id_incidencia = ?
            AND c.id_usuario_afectado = u.id
            AND c.estado IN ('pendiente', 'inhibido')
        )
        AND (
          (
            ? = 'interna'
            AND (
              r.codigo IN ('director', 'subdirector', 'coordinador_tutoria')
              OR u.id = ?
            )
          )
          OR (
            r.codigo IN ('director', 'subdirector')
            AND EXISTS (
              SELECT 1
              FROM roles_permisos rp
                JOIN permisos pe ON pe.id = rp.id_permiso
              WHERE rp.id_rol = u.id_rol
                AND pe.codigo = 'incidencias.restringidas'
            )
          )
        ) ${id ? 'AND u.id = ?' : ''}
      ORDER BY p.apellidos,
        p.nombres,
        u.id
    `,
    [incidencia.id, incidencia.confidencialidad, incidencia.id_registrador, ...(id ? [id] : [])]
  );
  return filas;
}

export async function registroPrevio(db, usuario, clave) {
  const [[fila]] = await db.execute(
    `
      SELECT h.id_incidencia AS id,
        h.valor_anterior AS huella,
        i.estado
      FROM historial h
        JOIN incidencias i ON i.id = h.id_incidencia
      WHERE h.id_actor = ?
        AND h.accion = 'incidencia_creada'
        AND h.campo = 'operacion_registro'
        AND h.valor_nuevo = ?
    `,
    [usuario.id, clave]
  );
  return fila;
}
