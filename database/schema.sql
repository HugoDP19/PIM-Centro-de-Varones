SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

CREATE TABLE personas (
    id BIGINT IDENTITY(1,1) NOT NULL,
    codigo_interno NVARCHAR(30) NOT NULL,
    nombres NVARCHAR(100) NOT NULL,
    apellidos NVARCHAR(150) NOT NULL,
    tipo_documento NVARCHAR(20) NULL,
    numero_documento NVARCHAR(40) NULL,
    pais_documento CHAR(2) NULL,
    es_personal TINYINT NOT NULL,
    telefono NVARCHAR(30) NULL,
    correo NVARCHAR(254) NULL,
    activo TINYINT NOT NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_personas_codigo UNIQUE (codigo_interno),

    CONSTRAINT ck_personas_documento CHECK (
        (pais_documento IS NULL AND tipo_documento IS NULL AND numero_documento IS NULL)
        OR (pais_documento IS NOT NULL AND tipo_documento IS NOT NULL AND numero_documento IS NOT NULL)
    ),
    CONSTRAINT ck_personas_booleanos CHECK (es_personal IN (0, 1) AND activo IN (0, 1)),
    CONSTRAINT ck_personas_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE roles (
    id BIGINT IDENTITY(1,1) NOT NULL,
    codigo NVARCHAR(30) NOT NULL,
    nombre NVARCHAR(60) NOT NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_roles_codigo UNIQUE (codigo),
    CONSTRAINT uq_roles_nombre UNIQUE (nombre),

    CONSTRAINT ck_roles_codigo CHECK (codigo IN (
        'director', 'subdirector', 'coordinador_tutoria', 'docente', 'auxiliar', 'administrador'
    )),
    CONSTRAINT ck_roles_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE usuarios (
    id BIGINT IDENTITY(1,1) NOT NULL,
    id_persona BIGINT NOT NULL,
    id_rol BIGINT NOT NULL,
    nombre_usuario NVARCHAR(60) NOT NULL,
    contrasena_hash NVARCHAR(255) NOT NULL,
    activo TINYINT NOT NULL,
    creado_en DATETIME2(6) NOT NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_usuarios_persona UNIQUE (id_persona),
    CONSTRAINT uq_usuarios_nombre UNIQUE (nombre_usuario),
    CONSTRAINT ck_usuarios_activo CHECK (activo IN (0, 1)),
    CONSTRAINT ck_usuarios_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_usuarios_id_persona_rango CHECK (id_persona BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_usuarios_id_rol_rango CHECK (id_rol BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE permisos (
    id BIGINT IDENTITY(1,1) NOT NULL,
    codigo NVARCHAR(80) NOT NULL,
    descripcion NVARCHAR(255) NOT NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_permisos_codigo UNIQUE (codigo),
    CONSTRAINT ck_permisos_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE roles_permisos (
    id_rol BIGINT NOT NULL,
    id_permiso BIGINT NOT NULL,
    PRIMARY KEY (id_rol, id_permiso),
    CONSTRAINT ck_roles_permisos_id_rol_rango CHECK (id_rol BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_roles_permisos_id_permiso_rango CHECK (id_permiso BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE estudiantes (
    id_persona BIGINT NOT NULL,
    codigo_estudiante NVARCHAR(30) NOT NULL,
    fecha_nacimiento DATE NULL,
    activo TINYINT NOT NULL,
    PRIMARY KEY (id_persona),    CONSTRAINT uq_estudiantes_codigo UNIQUE (codigo_estudiante),
    CONSTRAINT ck_estudiantes_activo CHECK (activo IN (0, 1)),
    CONSTRAINT ck_estudiantes_id_persona_rango CHECK (id_persona BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE estudiantes_apoderados (
    id BIGINT IDENTITY(1,1) NOT NULL,
    id_estudiante BIGINT NOT NULL,
    id_apoderado BIGINT NOT NULL,
    vinculo NVARCHAR(30) NOT NULL,
    es_principal TINYINT NOT NULL,
    vigente_desde DATE NOT NULL,
    vigente_hasta DATE NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_apoderados_periodo UNIQUE (id_estudiante, id_apoderado, vigente_desde),
    CONSTRAINT ck_apoderados_personas CHECK (id_estudiante <> id_apoderado),
    CONSTRAINT ck_apoderados_principal CHECK (es_principal IN (0, 1)),
    CONSTRAINT ck_apoderados_periodo CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
    CONSTRAINT ck_estudiantes_apoderados_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_estudiantes_apoderados_id_estudiante_rango CHECK (id_estudiante BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_estudiantes_apoderados_id_apoderado_rango CHECK (id_apoderado BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE aulas (
    id BIGINT IDENTITY(1,1) NOT NULL,
    anio_lectivo INT NOT NULL,
    nivel NVARCHAR(20) NOT NULL,
    grado TINYINT NOT NULL,
    seccion NVARCHAR(20) NOT NULL,
    activo TINYINT NOT NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_aulas_grupo UNIQUE (anio_lectivo, nivel, grado, seccion),
    CONSTRAINT ck_aulas_activo CHECK (activo IN (0, 1)),
    CONSTRAINT ck_aulas_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_aulas_anio_lectivo_rango CHECK (anio_lectivo BETWEEN 0 AND 65535),
    CONSTRAINT ck_aulas_grado_rango CHECK (grado BETWEEN 0 AND 255)
);

CREATE TABLE matriculas (
    id BIGINT IDENTITY(1,1) NOT NULL,
    id_estudiante BIGINT NOT NULL,
    id_aula BIGINT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_matriculas_inicio UNIQUE (id_estudiante, fecha_inicio),
    CONSTRAINT uq_matriculas_estudiante_id UNIQUE (id_estudiante, id),
    CONSTRAINT ck_matriculas_periodo CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT ck_matriculas_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_matriculas_id_estudiante_rango CHECK (id_estudiante BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_matriculas_id_aula_rango CHECK (id_aula BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE tipos_incidencia (
    id BIGINT IDENTITY(1,1) NOT NULL,
    categoria NVARCHAR(30) NOT NULL,
    nombre NVARCHAR(100) NOT NULL,
    minimo_estudiantes INT NOT NULL,
    activo TINYINT NOT NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_tipos_categoria_nombre UNIQUE (categoria, nombre),
    CONSTRAINT ck_tipos_categoria CHECK (categoria IN (
        'convivencia', 'disciplina', 'salud', 'seguridad', 'bienes', 'proteccion_estudiantil'
    )),
    CONSTRAINT ck_tipos_activo CHECK (activo IN (0, 1)),
    CONSTRAINT ck_tipos_incidencia_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_tipos_incidencia_minimo_estudiantes_rango CHECK (minimo_estudiantes BETWEEN 0 AND 65535)
);

CREATE TABLE incidencias (
    id BIGINT IDENTITY(1,1) NOT NULL,
    id_registrador BIGINT NOT NULL,
    id_rol_registrador BIGINT NOT NULL,
    nombre_registrador NVARCHAR(251) NOT NULL,
    registrada_en DATETIME2(6) NOT NULL,
    confirmada_en DATETIME2(6) NULL,
    estado NVARCHAR(20) NOT NULL,
    prioridad NVARCHAR(10) NOT NULL,
    confidencialidad NVARCHAR(20) NOT NULL,
    id_version_vigente BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_incidencias_estado CHECK (
        estado IN ('borrador', 'confirmada', 'en_seguimiento', 'cerrada', 'anulada')
    ),
    CONSTRAINT ck_incidencias_prioridad CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
    CONSTRAINT ck_incidencias_confidencialidad CHECK (confidencialidad IN ('interna', 'restringida')),
    CONSTRAINT ck_incidencias_confirmacion CHECK (
        (estado = 'borrador' AND confirmada_en IS NULL)
        OR (estado <> 'borrador' AND confirmada_en IS NOT NULL AND id_version_vigente IS NOT NULL)
    ),
    CONSTRAINT ck_incidencias_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_incidencias_id_registrador_rango CHECK (id_registrador BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_incidencias_id_rol_registrador_rango CHECK (id_rol_registrador BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_incidencias_id_version_vigente_rango CHECK (id_version_vigente BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE versiones_incidencia (
    id BIGINT IDENTITY(1,1) NOT NULL,
    id_incidencia BIGINT NOT NULL,
    numero_version BIGINT NOT NULL,
    estado_version NVARCHAR(20) NOT NULL,
    id_autor BIGINT NOT NULL,
    creada_en DATETIME2(6) NOT NULL,
    id_tipo BIGINT NOT NULL,
    titulo NVARCHAR(200) NOT NULL,
    descripcion NVARCHAR(MAX) NOT NULL,
    ocurrida_en DATETIME2(6) NULL,
    lugar NVARCHAR(255) NULL,
    id_reportante BIGINT NOT NULL,
    condicion_reportante NVARCHAR(20) NOT NULL,
    nombre_reportante NVARCHAR(251) NOT NULL,
    gravedad_disciplinaria NVARCHAR(20) NULL,
    ambito_convivencia NVARCHAR(20) NULL,
    requiere_mediacion TINYINT NULL,
    norma_referida NVARCHAR(100) NULL,
    sintomas_observados NVARCHAR(MAX) NULL,
    requiere_atencion_inmediata TINYINT NULL,
    riesgo_identificado NVARCHAR(MAX) NULL,
    riesgo_persistente TINYINT NULL,
    descripcion_dano NVARCHAR(MAX) NULL,
    monto_estimado DECIMAL(12,2) NULL,
    moneda CHAR(3) NULL,
    riesgo_inmediato TINYINT NULL,
    requiere_derivacion TINYINT NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_versiones_numero UNIQUE (id_incidencia, numero_version),
    CONSTRAINT uq_versiones_incidencia_id UNIQUE (id_incidencia, id),
    CONSTRAINT ck_versiones_numero CHECK (numero_version > 0),
    CONSTRAINT ck_versiones_estado CHECK (estado_version IN ('borrador', 'propuesta', 'confirmada')),
    CONSTRAINT ck_versiones_reportante CHECK (
        condicion_reportante IN ('personal', 'estudiante', 'apoderado', 'externo')
    ),
    CONSTRAINT ck_versiones_gravedad CHECK (
        gravedad_disciplinaria IS NULL
        OR gravedad_disciplinaria IN ('por_evaluar', 'leve', 'grave', 'muy_grave')
    ),
    CONSTRAINT ck_versiones_ambito CHECK (
        ambito_convivencia IS NULL OR ambito_convivencia IN ('presencial', 'digital', 'mixto')
    ),
    CONSTRAINT ck_versiones_booleanos CHECK (
        (requiere_mediacion IS NULL OR requiere_mediacion IN (0, 1))
        AND (requiere_atencion_inmediata IS NULL OR requiere_atencion_inmediata IN (0, 1))
        AND (riesgo_persistente IS NULL OR riesgo_persistente IN (0, 1))
        AND (riesgo_inmediato IS NULL OR riesgo_inmediato IN (0, 1))
        AND (requiere_derivacion IS NULL OR requiere_derivacion IN (0, 1))
    ),
    CONSTRAINT ck_versiones_importe CHECK (
        (monto_estimado IS NULL AND moneda IS NULL)
        OR (monto_estimado IS NOT NULL AND monto_estimado >= 0 AND moneda IS NOT NULL)
    ),
    CONSTRAINT ck_versiones_incidencia_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_versiones_incidencia_id_incidencia_rango CHECK (id_incidencia BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_versiones_incidencia_numero_version_rango CHECK (numero_version BETWEEN 0 AND 4294967295),
    CONSTRAINT ck_versiones_incidencia_id_autor_rango CHECK (id_autor BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_versiones_incidencia_id_tipo_rango CHECK (id_tipo BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_versiones_incidencia_id_reportante_rango CHECK (id_reportante BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE involucrados (
    id_version BIGINT NOT NULL,
    id_persona BIGINT NOT NULL,
    id_matricula BIGINT NULL,
    participacion NVARCHAR(30) NOT NULL,
    PRIMARY KEY (id_version, id_persona),
    CONSTRAINT ck_involucrados_participacion CHECK (participacion IN ('afectado', 'testigo', 'involucrado')),
    CONSTRAINT ck_involucrados_id_version_rango CHECK (id_version BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_involucrados_id_persona_rango CHECK (id_persona BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_involucrados_id_matricula_rango CHECK (id_matricula BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE actuaciones (
    id BIGINT IDENTITY(1,1) NOT NULL,
    id_incidencia BIGINT NOT NULL,
    id_autor BIGINT NOT NULL,
    id_rol_autor BIGINT NOT NULL,
    tipo NVARCHAR(20) NOT NULL,
    detalle NVARCHAR(MAX) NOT NULL,
    realizada_en DATETIME2(6) NOT NULL,
    registrada_en DATETIME2(6) NOT NULL,
    id_responsable BIGINT NULL,
    fecha_limite DATE NULL,
    id_actuacion_corregida BIGINT NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_actuaciones_incidencia_id UNIQUE (id_incidencia, id),
    CONSTRAINT ck_actuaciones_tipo CHECK (tipo IN ('actuacion', 'observacion')),
    CONSTRAINT ck_actuaciones_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_actuaciones_id_incidencia_rango CHECK (id_incidencia BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_actuaciones_id_autor_rango CHECK (id_autor BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_actuaciones_id_rol_autor_rango CHECK (id_rol_autor BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_actuaciones_id_responsable_rango CHECK (id_responsable BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_actuaciones_id_actuacion_corregida_rango CHECK (id_actuacion_corregida BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE solicitudes_cambio (
    id BIGINT IDENTITY(1,1) NOT NULL,
    id_incidencia BIGINT NOT NULL,
    id_solicitante BIGINT NOT NULL,
    id_rol_solicitante BIGINT NOT NULL,
    tipo NVARCHAR(20) NOT NULL,
    justificacion NVARCHAR(MAX) NOT NULL,
    creada_en DATETIME2(6) NOT NULL,
    estado NVARCHAR(20) NOT NULL,
    id_version_base BIGINT NOT NULL,
    id_version_propuesta BIGINT NULL,
    confidencialidad_propuesta NVARCHAR(20) NULL,
    motivo_anulacion NVARCHAR(20) NULL,
    id_incidencia_duplicada BIGINT NULL,
    id_evaluador BIGINT NULL,
    evaluada_en DATETIME2(6) NULL,
    requiere_revision TINYINT NULL,
    fundamento_revision NVARCHAR(500) NULL,
    id_revision_resolutiva BIGINT NULL,
    id_decisor BIGINT NULL,
    id_rol_decisor BIGINT NULL,
    fundamento_decision NVARCHAR(MAX) NULL,
    decidida_en DATETIME2(6) NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_solicitudes_incidencia_id UNIQUE (id_incidencia, id),
    CONSTRAINT ck_solicitudes_tipo CHECK (tipo IN ('rectificacion', 'anulacion')),
    CONSTRAINT ck_solicitudes_estado CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'retirada', 'obsoleta')),
    CONSTRAINT ck_solicitudes_confidencialidad CHECK (
        confidencialidad_propuesta IS NULL OR confidencialidad_propuesta IN ('interna', 'restringida')
    ),
    CONSTRAINT ck_solicitudes_contenido CHECK (
        (tipo = 'rectificacion' AND motivo_anulacion IS NULL AND id_incidencia_duplicada IS NULL
            AND (id_version_propuesta IS NOT NULL OR confidencialidad_propuesta IS NOT NULL)
            AND (id_version_propuesta IS NULL OR id_version_propuesta <> id_version_base))
        OR (tipo = 'anulacion' AND id_version_propuesta IS NULL AND confidencialidad_propuesta IS NULL
            AND motivo_anulacion IS NOT NULL AND (
                (motivo_anulacion = 'duplicado' AND id_incidencia_duplicada IS NOT NULL
                    AND id_incidencia_duplicada <> id_incidencia)
                OR (motivo_anulacion = 'otro' AND id_incidencia_duplicada IS NULL)
            ))
    ),
    CONSTRAINT ck_solicitudes_evaluacion CHECK (
        (id_evaluador IS NULL AND evaluada_en IS NULL AND requiere_revision IS NULL AND fundamento_revision IS NULL)
        OR (id_evaluador IS NOT NULL AND evaluada_en IS NOT NULL AND requiere_revision IS NOT NULL
            AND requiere_revision IN (0, 1) AND fundamento_revision IS NOT NULL
            AND id_evaluador <> id_solicitante)
    ),
    CONSTRAINT ck_solicitudes_decision CHECK (
        (estado IN ('aprobada', 'rechazada') AND id_decisor IS NOT NULL AND id_rol_decisor IS NOT NULL
            AND fundamento_decision IS NOT NULL AND decidida_en IS NOT NULL
            AND id_decisor <> id_solicitante AND id_evaluador IS NOT NULL)
        OR (estado IN ('pendiente', 'retirada', 'obsoleta') AND id_decisor IS NULL AND id_rol_decisor IS NULL
            AND fundamento_decision IS NULL AND decidida_en IS NULL)
    ),
    CONSTRAINT ck_solicitudes_revision_aprobada CHECK (
        estado <> 'aprobada' OR requiere_revision = 0 OR id_revision_resolutiva IS NOT NULL
    ),
    CONSTRAINT ck_solicitudes_cambio_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_solicitudes_cambio_id_incidencia_rango CHECK (id_incidencia BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_solicitudes_cambio_id_solicitante_rango CHECK (id_solicitante BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_solicitudes_cambio_id_rol_solicitante_rango CHECK (id_rol_solicitante BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_solicitudes_cambio_id_version_base_rango CHECK (id_version_base BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_solicitudes_cambio_id_version_propuesta_rango CHECK (id_version_propuesta BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_solicitudes_cambio_id_incidencia_duplicada_rango CHECK (id_incidencia_duplicada BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_solicitudes_cambio_id_evaluador_rango CHECK (id_evaluador BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_solicitudes_cambio_id_revision_resolutiva_rango CHECK (id_revision_resolutiva BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_solicitudes_cambio_id_decisor_rango CHECK (id_decisor BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_solicitudes_cambio_id_rol_decisor_rango CHECK (id_rol_decisor BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE revisiones (
    id BIGINT IDENTITY(1,1) NOT NULL,
    id_incidencia BIGINT NOT NULL,
    id_solicitud BIGINT NULL,
    id_responsable BIGINT NOT NULL,
    motivo NVARCHAR(MAX) NOT NULL,
    abierta_en DATETIME2(6) NOT NULL,
    cerrada_en DATETIME2(6) NULL,
    estado NVARCHAR(20) NOT NULL,
    requiere_reunion TINYINT NOT NULL,
    hubo_reunion TINYINT NOT NULL,
    reunion_en DATETIME2(6) NULL,
    requiere_acta TINYINT NOT NULL,
    fundamento_acta NVARCHAR(500) NOT NULL,
    acta NVARCHAR(MAX) NULL,
    id_emisor_acta BIGINT NULL,
    acta_emitida_en DATETIME2(6) NULL,
    conclusion NVARCHAR(MAX) NULL,
    id_revision_anterior BIGINT NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_revisiones_incidencia_id UNIQUE (id_incidencia, id),
    CONSTRAINT ck_revisiones_estado CHECK (estado IN ('abierta', 'concluida')),
    CONSTRAINT ck_revisiones_booleanos CHECK (
        requiere_reunion IN (0, 1) AND hubo_reunion IN (0, 1) AND requiere_acta IN (0, 1)
    ),
    CONSTRAINT ck_revisiones_reunion CHECK (
        (hubo_reunion = 0 AND reunion_en IS NULL) OR (hubo_reunion = 1 AND reunion_en IS NOT NULL)
    ),
    CONSTRAINT ck_revisiones_acta CHECK (
        (acta IS NULL AND id_emisor_acta IS NULL AND acta_emitida_en IS NULL)
        OR (acta IS NOT NULL AND id_emisor_acta IS NOT NULL AND acta_emitida_en IS NOT NULL)
    ),
    CONSTRAINT ck_revisiones_cierre CHECK (
        (estado = 'abierta' AND cerrada_en IS NULL)
        OR (estado = 'concluida' AND cerrada_en IS NOT NULL AND conclusion IS NOT NULL
            AND (requiere_reunion = 0 OR hubo_reunion = 1)
            AND (requiere_acta = 0 OR acta_emitida_en IS NOT NULL))
    ),
    CONSTRAINT ck_revisiones_periodo CHECK (cerrada_en IS NULL OR cerrada_en >= abierta_en),
    CONSTRAINT ck_revisiones_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_revisiones_id_incidencia_rango CHECK (id_incidencia BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_revisiones_id_solicitud_rango CHECK (id_solicitud BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_revisiones_id_responsable_rango CHECK (id_responsable BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_revisiones_id_emisor_acta_rango CHECK (id_emisor_acta BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_revisiones_id_revision_anterior_rango CHECK (id_revision_anterior BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE participantes_revision (
    id_revision BIGINT NOT NULL,
    id_persona BIGINT NOT NULL,
    funcion NVARCHAR(40) NOT NULL,
    asistencia NVARCHAR(15) NOT NULL,
    intervencion NVARCHAR(MAX) NULL,
    nombre_participante NVARCHAR(251) NOT NULL,
    PRIMARY KEY (id_revision, id_persona),
    CONSTRAINT ck_participantes_asistencia CHECK (asistencia IN ('pendiente', 'asistio', 'ausente')),
    CONSTRAINT ck_participantes_revision_id_revision_rango CHECK (id_revision BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_participantes_revision_id_persona_rango CHECK (id_persona BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE conflictos_interes (
    id BIGINT IDENTITY(1,1) NOT NULL,
    id_incidencia BIGINT NOT NULL,
    id_usuario_afectado BIGINT NOT NULL,
    id_declarante BIGINT NOT NULL,
    motivo NVARCHAR(MAX) NOT NULL,
    declarado_en DATETIME2(6) NOT NULL,
    estado NVARCHAR(20) NOT NULL,
    id_resolutor BIGINT NULL,
    resuelto_en DATETIME2(6) NULL,
    fundamento_resolucion NVARCHAR(MAX) NULL,
    PRIMARY KEY (id),    CONSTRAINT uq_conflictos_incidencia_id UNIQUE (id_incidencia, id),
    CONSTRAINT ck_conflictos_estado CHECK (estado IN ('pendiente', 'inhibido', 'descartado')),
    CONSTRAINT ck_conflictos_resolucion CHECK (
        (id_resolutor IS NULL AND resuelto_en IS NULL AND fundamento_resolucion IS NULL AND estado <> 'descartado')
        OR (id_resolutor IS NOT NULL AND resuelto_en IS NOT NULL AND fundamento_resolucion IS NOT NULL
            AND id_resolutor <> id_usuario_afectado AND estado <> 'pendiente')
    ),
    CONSTRAINT ck_conflictos_interes_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_conflictos_interes_id_incidencia_rango CHECK (id_incidencia BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_conflictos_interes_id_usuario_afectado_rango CHECK (id_usuario_afectado BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_conflictos_interes_id_declarante_rango CHECK (id_declarante BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_conflictos_interes_id_resolutor_rango CHECK (id_resolutor BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE historial (
    id BIGINT IDENTITY(1,1) NOT NULL,
    id_actor BIGINT NOT NULL,
    id_rol_actor BIGINT NOT NULL,
    ocurrido_en DATETIME2(6) NOT NULL,
    accion NVARCHAR(60) NOT NULL,
    id_incidencia BIGINT NULL,
    id_persona BIGINT NULL,
    id_usuario_afectado BIGINT NULL,
    id_rol_afectado BIGINT NULL,
    id_permiso BIGINT NULL,
    id_vinculo_apoderado BIGINT NULL,
    id_aula BIGINT NULL,
    id_matricula BIGINT NULL,
    id_tipo_incidencia BIGINT NULL,
    id_version BIGINT NULL,
    id_estudiante BIGINT NULL,
    id_actuacion BIGINT NULL,
    id_solicitud BIGINT NULL,
    id_revision BIGINT NULL,
    id_conflicto BIGINT NULL,
    id_rol_anterior BIGINT NULL,
    id_rol_nuevo BIGINT NULL,
    campo NVARCHAR(60) NULL,
    valor_anterior NVARCHAR(MAX) NULL,
    valor_nuevo NVARCHAR(MAX) NULL,
    motivo NVARCHAR(MAX) NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_historial_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_actor_rango CHECK (id_actor BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_rol_actor_rango CHECK (id_rol_actor BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_incidencia_rango CHECK (id_incidencia BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_persona_rango CHECK (id_persona BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_usuario_afectado_rango CHECK (id_usuario_afectado BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_rol_afectado_rango CHECK (id_rol_afectado BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_permiso_rango CHECK (id_permiso BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_vinculo_apoderado_rango CHECK (id_vinculo_apoderado BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_aula_rango CHECK (id_aula BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_matricula_rango CHECK (id_matricula BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_tipo_incidencia_rango CHECK (id_tipo_incidencia BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_version_rango CHECK (id_version BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_estudiante_rango CHECK (id_estudiante BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_actuacion_rango CHECK (id_actuacion BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_solicitud_rango CHECK (id_solicitud BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_revision_rango CHECK (id_revision BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_conflicto_rango CHECK (id_conflicto BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_rol_anterior_rango CHECK (id_rol_anterior BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_historial_id_rol_nuevo_rango CHECK (id_rol_nuevo BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE sesiones (
    token_hash CHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
    id_usuario BIGINT NOT NULL,
    credencial_hash CHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
    creada_en DATETIME2(6) NOT NULL,
    ultima_actividad_en DATETIME2(6) NOT NULL,
    vence_en DATETIME2(6) NOT NULL,
    PRIMARY KEY (token_hash),
    CONSTRAINT ck_sesiones_id_usuario_rango CHECK (id_usuario BETWEEN 0 AND 9223372036854775807)
);

CREATE TABLE intentos_acceso (
    clave CHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
    cantidad BIGINT NOT NULL,
    vence_en DATETIME2(6) NOT NULL,
    PRIMARY KEY (clave),
    CONSTRAINT ck_intentos_acceso_cantidad_rango CHECK (cantidad BETWEEN 0 AND 4294967295)
);

CREATE TABLE autorizaciones_cuentas (
    id BIGINT IDENTITY(1,1) NOT NULL,
    tipo NVARCHAR(30) NOT NULL,
    id_usuario_objetivo BIGINT NULL,
    id_persona BIGINT NULL,
    id_rol_objetivo BIGINT NULL,
    id_permiso BIGINT NULL,
    nombre_usuario NVARCHAR(60) NULL,
    activo TINYINT NULL,
    huella_objetivo CHAR(64) NULL,
    id_autorizante BIGINT NULL,
    id_rol_autorizante BIGINT NULL,
    motivo NVARCHAR(500) NOT NULL,
    autorizada_en DATETIME2(6) NULL,
    vence_en DATETIME2(6) NOT NULL,
    id_ejecutor BIGINT NULL,
    ejecutada_en DATETIME2(6) NULL,
    id_solicitante BIGINT NULL,
    id_rol_solicitante BIGINT NULL,
    solicitada_en DATETIME2(6) NULL,
    estado NVARCHAR(30) NOT NULL DEFAULT 'legado',
    revision_doble TINYINT NOT NULL DEFAULT 0,
    id_decisor_director BIGINT NULL,
    decision_director NVARCHAR(10) NULL,
    fundamento_director NVARCHAR(500) NULL,
    decidida_director_en DATETIME2(6) NULL,
    id_decisor_subdirector BIGINT NULL,
    decision_subdirector NVARCHAR(10) NULL,
    fundamento_subdirector NVARCHAR(500) NULL,
    decidida_subdirector_en DATETIME2(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_autcuenta_tipo CHECK (tipo IN (
        'crear_cuenta', 'actualizar_cuenta', 'editar_cuenta', 'activar_cuenta', 'desactivar_cuenta',
        'restablecer_clave', 'cambiar_rol', 'asignar_permiso', 'retirar_permiso')),
    CONSTRAINT ck_autcuenta_activo CHECK (activo IS NULL OR activo IN (0, 1)),
    CONSTRAINT ck_autcuenta_ejecucion CHECK (
        (id_ejecutor IS NULL AND ejecutada_en IS NULL)
        OR (id_ejecutor IS NOT NULL AND ejecutada_en IS NOT NULL AND id_ejecutor <> id_autorizante)
    ),
    CONSTRAINT ck_autcuenta_estado CHECK (estado IN ('legado', 'pendiente', 'aprobada', 'rechazada', 'desacuerdo', 'ejecutada')),
    CONSTRAINT ck_autcuenta_solicitud CHECK (estado = 'legado' OR (id_solicitante IS NOT NULL AND id_rol_solicitante IS NOT NULL AND solicitada_en IS NOT NULL)),
    CONSTRAINT ck_autcuenta_doble CHECK (revision_doble IN (0, 1)),
    CONSTRAINT ck_autcuenta_decision_d CHECK (
        (id_decisor_director IS NULL AND decision_director IS NULL AND fundamento_director IS NULL AND decidida_director_en IS NULL)
        OR (id_decisor_director IS NOT NULL AND decision_director IS NOT NULL AND decision_director IN ('aprobar', 'rechazar')
            AND fundamento_director IS NOT NULL AND decidida_director_en IS NOT NULL AND id_decisor_director <> id_solicitante)),
    CONSTRAINT ck_autcuenta_decision_sd CHECK (
        (id_decisor_subdirector IS NULL AND decision_subdirector IS NULL AND fundamento_subdirector IS NULL AND decidida_subdirector_en IS NULL)
        OR (id_decisor_subdirector IS NOT NULL AND decision_subdirector IS NOT NULL AND decision_subdirector IN ('aprobar', 'rechazar')
            AND fundamento_subdirector IS NOT NULL AND decidida_subdirector_en IS NOT NULL AND id_decisor_subdirector <> id_solicitante)),
    CONSTRAINT ck_autcuenta_aprobada CHECK (estado NOT IN ('aprobada', 'ejecutada') OR (id_autorizante IS NOT NULL AND autorizada_en IS NOT NULL)),
    CONSTRAINT ck_autcuenta_ejecutada CHECK (estado <> 'ejecutada' OR (id_ejecutor IS NOT NULL AND ejecutada_en IS NOT NULL)),
    CONSTRAINT ck_autorizaciones_cuentas_id_rango CHECK (id BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_usuario_objetivo_rango CHECK (id_usuario_objetivo BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_persona_rango CHECK (id_persona BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_rol_objetivo_rango CHECK (id_rol_objetivo BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_permiso_rango CHECK (id_permiso BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_autorizante_rango CHECK (id_autorizante BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_rol_autorizante_rango CHECK (id_rol_autorizante BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_ejecutor_rango CHECK (id_ejecutor BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_solicitante_rango CHECK (id_solicitante BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_rol_solicitante_rango CHECK (id_rol_solicitante BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_decisor_director_rango CHECK (id_decisor_director BETWEEN 0 AND 9223372036854775807),
    CONSTRAINT ck_autorizaciones_cuentas_id_decisor_subdirector_rango CHECK (id_decisor_subdirector BETWEEN 0 AND 9223372036854775807)
);

ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_persona FOREIGN KEY (id_persona) REFERENCES personas (id);

ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_rol FOREIGN KEY (id_rol) REFERENCES roles (id);

ALTER TABLE roles_permisos ADD CONSTRAINT fk_roles_permisos_rol FOREIGN KEY (id_rol) REFERENCES roles (id);

ALTER TABLE roles_permisos ADD CONSTRAINT fk_roles_permisos_permiso FOREIGN KEY (id_permiso) REFERENCES permisos (id);

ALTER TABLE estudiantes ADD CONSTRAINT fk_estudiantes_persona FOREIGN KEY (id_persona) REFERENCES personas (id);

ALTER TABLE estudiantes_apoderados ADD CONSTRAINT fk_apoderados_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiantes (id_persona);

ALTER TABLE estudiantes_apoderados ADD CONSTRAINT fk_apoderados_persona FOREIGN KEY (id_apoderado) REFERENCES personas (id);

ALTER TABLE matriculas ADD CONSTRAINT fk_matriculas_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiantes (id_persona);

ALTER TABLE matriculas ADD CONSTRAINT fk_matriculas_aula FOREIGN KEY (id_aula) REFERENCES aulas (id);

ALTER TABLE incidencias ADD CONSTRAINT fk_incidencias_registrador FOREIGN KEY (id_registrador) REFERENCES usuarios (id);

ALTER TABLE incidencias ADD CONSTRAINT fk_incidencias_rol FOREIGN KEY (id_rol_registrador) REFERENCES roles (id);

ALTER TABLE versiones_incidencia ADD CONSTRAINT fk_versiones_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id);

ALTER TABLE versiones_incidencia ADD CONSTRAINT fk_versiones_autor FOREIGN KEY (id_autor) REFERENCES usuarios (id);

ALTER TABLE versiones_incidencia ADD CONSTRAINT fk_versiones_tipo FOREIGN KEY (id_tipo) REFERENCES tipos_incidencia (id);

ALTER TABLE versiones_incidencia ADD CONSTRAINT fk_versiones_reportante FOREIGN KEY (id_reportante) REFERENCES personas (id);

ALTER TABLE involucrados ADD CONSTRAINT fk_involucrados_version FOREIGN KEY (id_version) REFERENCES versiones_incidencia (id);

ALTER TABLE involucrados ADD CONSTRAINT fk_involucrados_persona FOREIGN KEY (id_persona) REFERENCES personas (id);

ALTER TABLE involucrados ADD CONSTRAINT fk_involucrados_persona_matricula FOREIGN KEY (id_persona, id_matricula) REFERENCES matriculas (id_estudiante, id);

ALTER TABLE actuaciones ADD CONSTRAINT fk_actuaciones_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id);

ALTER TABLE actuaciones ADD CONSTRAINT fk_actuaciones_autor FOREIGN KEY (id_autor) REFERENCES usuarios (id);

ALTER TABLE actuaciones ADD CONSTRAINT fk_actuaciones_rol FOREIGN KEY (id_rol_autor) REFERENCES roles (id);

ALTER TABLE actuaciones ADD CONSTRAINT fk_actuaciones_responsable FOREIGN KEY (id_responsable) REFERENCES usuarios (id);

ALTER TABLE actuaciones ADD CONSTRAINT fk_actuaciones_correccion FOREIGN KEY (id_incidencia, id_actuacion_corregida) REFERENCES actuaciones (id_incidencia, id);

ALTER TABLE solicitudes_cambio ADD CONSTRAINT fk_solicitudes_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id);

ALTER TABLE solicitudes_cambio ADD CONSTRAINT fk_solicitudes_solicitante FOREIGN KEY (id_solicitante) REFERENCES usuarios (id);

ALTER TABLE solicitudes_cambio ADD CONSTRAINT fk_solicitudes_rol_solicitante FOREIGN KEY (id_rol_solicitante) REFERENCES roles (id);

ALTER TABLE solicitudes_cambio ADD CONSTRAINT fk_solicitudes_base FOREIGN KEY (id_incidencia, id_version_base) REFERENCES versiones_incidencia (id_incidencia, id);

ALTER TABLE solicitudes_cambio ADD CONSTRAINT fk_solicitudes_propuesta FOREIGN KEY (id_incidencia, id_version_propuesta) REFERENCES versiones_incidencia (id_incidencia, id);

ALTER TABLE solicitudes_cambio ADD CONSTRAINT fk_solicitudes_duplicada FOREIGN KEY (id_incidencia_duplicada) REFERENCES incidencias (id);

ALTER TABLE solicitudes_cambio ADD CONSTRAINT fk_solicitudes_evaluador FOREIGN KEY (id_evaluador) REFERENCES usuarios (id);

ALTER TABLE solicitudes_cambio ADD CONSTRAINT fk_solicitudes_decisor FOREIGN KEY (id_decisor) REFERENCES usuarios (id);

ALTER TABLE solicitudes_cambio ADD CONSTRAINT fk_solicitudes_rol_decisor FOREIGN KEY (id_rol_decisor) REFERENCES roles (id);

ALTER TABLE revisiones ADD CONSTRAINT fk_revisiones_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id);

ALTER TABLE revisiones ADD CONSTRAINT fk_revisiones_solicitud FOREIGN KEY (id_incidencia, id_solicitud) REFERENCES solicitudes_cambio (id_incidencia, id);

ALTER TABLE revisiones ADD CONSTRAINT fk_revisiones_responsable FOREIGN KEY (id_responsable) REFERENCES usuarios (id);

ALTER TABLE revisiones ADD CONSTRAINT fk_revisiones_emisor FOREIGN KEY (id_emisor_acta) REFERENCES usuarios (id);

ALTER TABLE revisiones ADD CONSTRAINT fk_revisiones_anterior FOREIGN KEY (id_incidencia, id_revision_anterior) REFERENCES revisiones (id_incidencia, id);

ALTER TABLE participantes_revision ADD CONSTRAINT fk_participantes_revision FOREIGN KEY (id_revision) REFERENCES revisiones (id);

ALTER TABLE participantes_revision ADD CONSTRAINT fk_participantes_persona FOREIGN KEY (id_persona) REFERENCES personas (id);

ALTER TABLE conflictos_interes ADD CONSTRAINT fk_conflictos_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id);

ALTER TABLE conflictos_interes ADD CONSTRAINT fk_conflictos_usuario FOREIGN KEY (id_usuario_afectado) REFERENCES usuarios (id);

ALTER TABLE conflictos_interes ADD CONSTRAINT fk_conflictos_declarante FOREIGN KEY (id_declarante) REFERENCES usuarios (id);

ALTER TABLE conflictos_interes ADD CONSTRAINT fk_conflictos_resolutor FOREIGN KEY (id_resolutor) REFERENCES usuarios (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_actor FOREIGN KEY (id_actor) REFERENCES usuarios (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_rol_actor FOREIGN KEY (id_rol_actor) REFERENCES roles (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_persona FOREIGN KEY (id_persona) REFERENCES personas (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario_afectado) REFERENCES usuarios (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_rol FOREIGN KEY (id_rol_afectado) REFERENCES roles (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_permiso FOREIGN KEY (id_permiso) REFERENCES permisos (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_apoderado FOREIGN KEY (id_vinculo_apoderado) REFERENCES estudiantes_apoderados (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_aula FOREIGN KEY (id_aula) REFERENCES aulas (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_matricula FOREIGN KEY (id_matricula) REFERENCES matriculas (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_tipo FOREIGN KEY (id_tipo_incidencia) REFERENCES tipos_incidencia (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_version FOREIGN KEY (id_version) REFERENCES versiones_incidencia (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiantes (id_persona);

ALTER TABLE historial ADD CONSTRAINT fk_historial_actuacion FOREIGN KEY (id_actuacion) REFERENCES actuaciones (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes_cambio (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_revision FOREIGN KEY (id_revision) REFERENCES revisiones (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_conflicto FOREIGN KEY (id_conflicto) REFERENCES conflictos_interes (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_rol_anterior FOREIGN KEY (id_rol_anterior) REFERENCES roles (id);

ALTER TABLE historial ADD CONSTRAINT fk_historial_rol_nuevo FOREIGN KEY (id_rol_nuevo) REFERENCES roles (id);

ALTER TABLE incidencias
    ADD CONSTRAINT fk_incidencias_version_vigente
    FOREIGN KEY (id, id_version_vigente)
    REFERENCES versiones_incidencia (id_incidencia, id);

ALTER TABLE solicitudes_cambio
    ADD CONSTRAINT fk_solicitudes_revision_resolutiva
    FOREIGN KEY (id_incidencia, id_revision_resolutiva)
    REFERENCES revisiones (id_incidencia, id);

ALTER TABLE sesiones ADD CONSTRAINT fk_sesiones_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_usuario FOREIGN KEY (id_usuario_objetivo) REFERENCES usuarios (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_persona FOREIGN KEY (id_persona) REFERENCES personas (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_rol FOREIGN KEY (id_rol_objetivo) REFERENCES roles (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_permiso FOREIGN KEY (id_permiso) REFERENCES permisos (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_autor FOREIGN KEY (id_autorizante) REFERENCES usuarios (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_rol_autor FOREIGN KEY (id_rol_autorizante) REFERENCES roles (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_ejecutor FOREIGN KEY (id_ejecutor) REFERENCES usuarios (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_solicitante FOREIGN KEY (id_solicitante) REFERENCES usuarios (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_rol_solicitante FOREIGN KEY (id_rol_solicitante) REFERENCES roles (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_decisor_d FOREIGN KEY (id_decisor_director) REFERENCES usuarios (id);

ALTER TABLE autorizaciones_cuentas ADD CONSTRAINT fk_autcuenta_decisor_sd FOREIGN KEY (id_decisor_subdirector) REFERENCES usuarios (id);

CREATE UNIQUE INDEX uq_personas_documento ON personas (pais_documento, tipo_documento, numero_documento) WHERE pais_documento IS NOT NULL AND tipo_documento IS NOT NULL AND numero_documento IS NOT NULL;

CREATE INDEX ix_apoderados_persona_vigencia ON estudiantes_apoderados (id_apoderado, vigente_desde);

CREATE INDEX ix_incidencias_estado_prioridad_fecha ON incidencias (estado, prioridad, registrada_en);

CREATE INDEX ix_involucrados_persona_version ON involucrados (id_persona, id_version);

CREATE INDEX ix_actuaciones_incidencia_fecha ON actuaciones (id_incidencia, registrada_en);

CREATE UNIQUE INDEX uq_solicitudes_propuesta ON solicitudes_cambio (id_version_propuesta) WHERE id_version_propuesta IS NOT NULL;

CREATE INDEX ix_solicitudes_incidencia_estado ON solicitudes_cambio (id_incidencia, estado);

CREATE UNIQUE INDEX uq_revisiones_anterior ON revisiones (id_revision_anterior) WHERE id_revision_anterior IS NOT NULL;

CREATE INDEX ix_conflictos_incidencia_usuario_estado ON conflictos_interes (id_incidencia, id_usuario_afectado, estado);

CREATE INDEX ix_historial_incidencia_fecha ON historial (id_incidencia, ocurrido_en);

CREATE INDEX ix_sesiones_vencimiento ON sesiones (vence_en);

CREATE INDEX ix_intentos_vencimiento ON intentos_acceso (vence_en);

CREATE INDEX ix_fk_usuarios_persona ON usuarios (id_persona);

CREATE INDEX ix_fk_usuarios_rol ON usuarios (id_rol);

CREATE INDEX ix_fk_roles_permisos_rol ON roles_permisos (id_rol);

CREATE INDEX ix_fk_roles_permisos_permiso ON roles_permisos (id_permiso);

CREATE INDEX ix_fk_estudiantes_persona ON estudiantes (id_persona);

CREATE INDEX ix_fk_apoderados_estudiante ON estudiantes_apoderados (id_estudiante);

CREATE INDEX ix_fk_apoderados_persona ON estudiantes_apoderados (id_apoderado);

CREATE INDEX ix_fk_matriculas_estudiante ON matriculas (id_estudiante);

CREATE INDEX ix_fk_matriculas_aula ON matriculas (id_aula);

CREATE INDEX ix_fk_incidencias_registrador ON incidencias (id_registrador);

CREATE INDEX ix_fk_incidencias_rol ON incidencias (id_rol_registrador);

CREATE INDEX ix_fk_versiones_incidencia ON versiones_incidencia (id_incidencia);

CREATE INDEX ix_fk_versiones_autor ON versiones_incidencia (id_autor);

CREATE INDEX ix_fk_versiones_tipo ON versiones_incidencia (id_tipo);

CREATE INDEX ix_fk_versiones_reportante ON versiones_incidencia (id_reportante);

CREATE INDEX ix_fk_involucrados_version ON involucrados (id_version);

CREATE INDEX ix_fk_involucrados_persona ON involucrados (id_persona);

CREATE INDEX ix_fk_involucrados_persona_matricula ON involucrados (id_persona, id_matricula);

CREATE INDEX ix_fk_actuaciones_incidencia ON actuaciones (id_incidencia);

CREATE INDEX ix_fk_actuaciones_autor ON actuaciones (id_autor);

CREATE INDEX ix_fk_actuaciones_rol ON actuaciones (id_rol_autor);

CREATE INDEX ix_fk_actuaciones_responsable ON actuaciones (id_responsable);

CREATE INDEX ix_fk_actuaciones_correccion ON actuaciones (id_incidencia, id_actuacion_corregida);

CREATE INDEX ix_fk_solicitudes_incidencia ON solicitudes_cambio (id_incidencia);

CREATE INDEX ix_fk_solicitudes_solicitante ON solicitudes_cambio (id_solicitante);

CREATE INDEX ix_fk_solicitudes_rol_solicitante ON solicitudes_cambio (id_rol_solicitante);

CREATE INDEX ix_fk_solicitudes_base ON solicitudes_cambio (id_incidencia, id_version_base);

CREATE INDEX ix_fk_solicitudes_propuesta ON solicitudes_cambio (id_incidencia, id_version_propuesta);

CREATE INDEX ix_fk_solicitudes_duplicada ON solicitudes_cambio (id_incidencia_duplicada);

CREATE INDEX ix_fk_solicitudes_evaluador ON solicitudes_cambio (id_evaluador);

CREATE INDEX ix_fk_solicitudes_decisor ON solicitudes_cambio (id_decisor);

CREATE INDEX ix_fk_solicitudes_rol_decisor ON solicitudes_cambio (id_rol_decisor);

CREATE INDEX ix_fk_revisiones_incidencia ON revisiones (id_incidencia);

CREATE INDEX ix_fk_revisiones_solicitud ON revisiones (id_incidencia, id_solicitud);

CREATE INDEX ix_fk_revisiones_responsable ON revisiones (id_responsable);

CREATE INDEX ix_fk_revisiones_emisor ON revisiones (id_emisor_acta);

CREATE INDEX ix_fk_revisiones_anterior ON revisiones (id_incidencia, id_revision_anterior);

CREATE INDEX ix_fk_participantes_revision ON participantes_revision (id_revision);

CREATE INDEX ix_fk_participantes_persona ON participantes_revision (id_persona);

CREATE INDEX ix_fk_conflictos_incidencia ON conflictos_interes (id_incidencia);

CREATE INDEX ix_fk_conflictos_usuario ON conflictos_interes (id_usuario_afectado);

CREATE INDEX ix_fk_conflictos_declarante ON conflictos_interes (id_declarante);

CREATE INDEX ix_fk_conflictos_resolutor ON conflictos_interes (id_resolutor);

CREATE INDEX ix_fk_historial_actor ON historial (id_actor);

CREATE INDEX ix_fk_historial_rol_actor ON historial (id_rol_actor);

CREATE INDEX ix_fk_historial_incidencia ON historial (id_incidencia);

CREATE INDEX ix_fk_historial_persona ON historial (id_persona);

CREATE INDEX ix_fk_historial_usuario ON historial (id_usuario_afectado);

CREATE INDEX ix_fk_historial_rol ON historial (id_rol_afectado);

CREATE INDEX ix_fk_historial_permiso ON historial (id_permiso);

CREATE INDEX ix_fk_historial_apoderado ON historial (id_vinculo_apoderado);

CREATE INDEX ix_fk_historial_aula ON historial (id_aula);

CREATE INDEX ix_fk_historial_matricula ON historial (id_matricula);

CREATE INDEX ix_fk_historial_tipo ON historial (id_tipo_incidencia);

CREATE INDEX ix_fk_historial_version ON historial (id_version);

CREATE INDEX ix_fk_historial_estudiante ON historial (id_estudiante);

CREATE INDEX ix_fk_historial_actuacion ON historial (id_actuacion);

CREATE INDEX ix_fk_historial_solicitud ON historial (id_solicitud);

CREATE INDEX ix_fk_historial_revision ON historial (id_revision);

CREATE INDEX ix_fk_historial_conflicto ON historial (id_conflicto);

CREATE INDEX ix_fk_historial_rol_anterior ON historial (id_rol_anterior);

CREATE INDEX ix_fk_historial_rol_nuevo ON historial (id_rol_nuevo);

CREATE INDEX ix_fk_sesiones_usuario ON sesiones (id_usuario);

CREATE INDEX ix_fk_autcuenta_usuario ON autorizaciones_cuentas (id_usuario_objetivo);

CREATE INDEX ix_fk_autcuenta_persona ON autorizaciones_cuentas (id_persona);

CREATE INDEX ix_fk_autcuenta_rol ON autorizaciones_cuentas (id_rol_objetivo);

CREATE INDEX ix_fk_autcuenta_permiso ON autorizaciones_cuentas (id_permiso);

CREATE INDEX ix_fk_autcuenta_autor ON autorizaciones_cuentas (id_autorizante);

CREATE INDEX ix_fk_autcuenta_rol_autor ON autorizaciones_cuentas (id_rol_autorizante);

CREATE INDEX ix_fk_autcuenta_ejecutor ON autorizaciones_cuentas (id_ejecutor);

CREATE INDEX ix_fk_autcuenta_solicitante ON autorizaciones_cuentas (id_solicitante);

CREATE INDEX ix_fk_autcuenta_rol_solicitante ON autorizaciones_cuentas (id_rol_solicitante);

CREATE INDEX ix_fk_autcuenta_decisor_d ON autorizaciones_cuentas (id_decisor_director);

CREATE INDEX ix_fk_autcuenta_decisor_sd ON autorizaciones_cuentas (id_decisor_subdirector);
