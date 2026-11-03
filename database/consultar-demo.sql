-- Solo lectura. Ejecutar en Workbench con acceso local autorizado.
USE sice_desarrollo;

-- 23 expedientes: código visible derivado de la PK, sin añadir una columna redundante.
SELECT
    CONCAT('INC-', LPAD(i.id, 6, '0')) AS codigo_incidencia,
    v.titulo,
    t.categoria,
    t.nombre AS tipo,
    CONVERT_TZ(v.ocurrida_en, '+00:00', '-05:00') AS ocurrida_en_lima,
    v.lugar,
    i.estado,
    i.prioridad,
    i.confidencialidad,
    i.nombre_registrador,
    r.nombre AS rol_registrador,
    v.nombre_reportante,
    v.descripcion,
    v.gravedad_disciplinaria
FROM incidencias i
JOIN versiones_incidencia v ON v.id = i.id_version_vigente
JOIN tipos_incidencia t ON t.id = v.id_tipo
JOIN roles r ON r.id = i.id_rol_registrador
ORDER BY i.id;

-- Aula histórica y participación por versión (incluye versiones anteriores).
SELECT
    v.titulo,
    v.numero_version,
    p.codigo_interno AS estudiante_sintetico,
    a.nivel,
    a.grado,
    a.seccion,
    inv.participacion
FROM involucrados inv
JOIN versiones_incidencia v ON v.id = inv.id_version
JOIN personas p ON p.id = inv.id_estudiante
LEFT JOIN matriculas m ON m.id = inv.id_matricula
LEFT JOIN aulas a ON a.id = m.id_aula
ORDER BY v.id_incidencia, v.numero_version, p.codigo_interno;

-- Seguimiento y comunicaciones; responsables reales de las cuentas sintéticas.
SELECT
    a.id_incidencia,
    a.detalle,
    CONVERT_TZ(a.realizada_en, '+00:00', '-05:00') AS realizada_en_lima,
    u.nombre_usuario AS responsable,
    a.fecha_limite
FROM actuaciones a
LEFT JOIN usuarios u ON u.id = a.id_responsable
ORDER BY a.id_incidencia, a.realizada_en;

-- Datos de escenarios futuros: esto no ejecuta ni prueba el flujo de aprobación.
SELECT
    s.id_incidencia,
    s.tipo,
    s.estado,
    s.id_version_base,
    s.id_version_propuesta,
    s.id_incidencia_duplicada,
    solicitante.nombre_usuario AS solicitante,
    evaluador.nombre_usuario AS evaluador,
    decisor.nombre_usuario AS decisor,
    s.fundamento_decision
FROM solicitudes_cambio s
JOIN usuarios solicitante ON solicitante.id = s.id_solicitante
LEFT JOIN usuarios evaluador ON evaluador.id = s.id_evaluador
LEFT JOIN usuarios decisor ON decisor.id = s.id_decisor
ORDER BY s.id;

SELECT id_incidencia, numero_version, estado_version, lugar, descripcion
FROM versiones_incidencia
WHERE id_incidencia IN (SELECT id_incidencia FROM solicitudes_cambio)
ORDER BY id_incidencia, numero_version;

SELECT id_incidencia, ocurrido_en, accion, campo, valor_anterior, valor_nuevo
FROM historial
WHERE id_incidencia IS NOT NULL
ORDER BY id_incidencia, ocurrido_en, id;
