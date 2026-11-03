-- SICE-Local / I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete.
-- Fase 2.5: borrador técnico de las 19 tablas propuestas, no modelo aprobado.
-- MySQL 8.0.16 o superior: versiones anteriores no aplican los CHECK.
-- Ejecutar completo solo en una base de pruebas vacía, elegida y autorizada
-- fuera del script. No crea bases, usuarios, permisos SQL ni datos iniciales.
-- No es una migración ni es idempotente; no usar --force para ignorar errores.
-- No se desactivan FK. Las dos referencias circulares se agregan al final.
-- Las FK omiten acciones: InnoDB aplica NO ACTION (= RESTRICT), sin cascadas.
-- Así también se evitan acciones referenciales explícitas en columnas CHECK.
-- Todos los DATETIME son UTC por contrato con el futuro backend.
-- Referencia técnica CHECK: https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html
-- Referencia FK: https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html
--
-- Alcance autorizado en desarrollo: involucrados relaciona personas, incluidos
-- testigos adultos. La matrícula sigue siendo exclusiva de estudiantes.
-- Confidencialidad por expediente completo, sin acceso parcial por testigo.
--
-- OBLIGACIONES POSTERIORES DEL BACKEND Y DE LOS PRIVILEGIOS SQL:
-- * Sesión/autoría del servidor, seis roles, acciones y alcance por expediente;
--   Administrador solo cuentas/permisos autorizados, sin contenido de casos.
-- * Validar categoría, campos pertinentes, mínimos de estudiantes (pueden ser
--   cero), identidad reportante, vigencias/matrículas y fechas de ocurrencia.
-- * Salud no es falta disciplinaria; prioridad no es gravedad. Validar NULL
--   en campos ajenos a categoría y restringir información sensible/histórica.
-- * Congelar hechos/involucrados confirmados, propuestas presentadas, actas
--   emitidas y revisiones concluidas. Seguimiento solo por adición/corrección
--   enlazada. No borrar incidencias, versiones, solicitudes ni evidencias.
-- * RESTRICT no impide por sí solo borrar filas o editar hechos: la cuenta
--   de ejecución debe carecer de DELETE/DDL y de UPDATE/DELETE en historial.
--   Estos privilegios y la inmutabilidad aún no están implementados.
-- * D/SD competente e independiente por persona/cuenta; validar conflictos,
--   composición/quórum/acta, revisión de la misma solicitud, sin ciclos en
--   correcciones. Si ambos están impedidos, bloquear; no sustituye AD.
-- * Bloquear incidencia para numerar versiones y permitir solo una solicitud
--   pendiente. Revalidar base vigente y aplicar decisión/versión/anulación/
--   historial atómicamente. Una decisión final no se sobrescribe.
-- * No bajar confidencialidad si versiones/actuaciones/actas conservan datos
--   sensibles. Auditar operaciones y lecturas/exportaciones autorizadas.
-- * No autorizar el uso operativo hasta resolver las decisiones institucionales
--   de REGLAS_FUNCIONALES.md; el DDL no implementa autenticación ni permisos.

CREATE TABLE personas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo_interno VARCHAR(30) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(150) NOT NULL,
    tipo_documento VARCHAR(20) NULL,
    numero_documento VARCHAR(40) NULL,
    pais_documento CHAR(2) NULL,
    es_personal BOOLEAN NOT NULL,
    telefono VARCHAR(30) NULL,
    correo VARCHAR(254) NULL,
    activo BOOLEAN NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_personas_codigo (codigo_interno),
    UNIQUE KEY uq_personas_documento (pais_documento, tipo_documento, numero_documento),
    CONSTRAINT ck_personas_documento CHECK (
        (pais_documento IS NULL AND tipo_documento IS NULL AND numero_documento IS NULL)
        OR (pais_documento IS NOT NULL AND tipo_documento IS NOT NULL AND numero_documento IS NOT NULL)
    ),
    CONSTRAINT ck_personas_booleanos CHECK (es_personal IN (0, 1) AND activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(60) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_codigo (codigo),
    UNIQUE KEY uq_roles_nombre (nombre),
    -- Códigos técnicos de los seis roles; no se crean filas ni concesiones.
    CONSTRAINT ck_roles_codigo CHECK (codigo IN (
        'director', 'subdirector', 'coordinador_tutoria', 'docente', 'auxiliar', 'administrador'
    ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE usuarios (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_persona BIGINT UNSIGNED NOT NULL,
    id_rol BIGINT UNSIGNED NOT NULL,
    nombre_usuario VARCHAR(60) NOT NULL,
    contrasena_hash VARCHAR(255) NOT NULL,
    activo BOOLEAN NOT NULL,
    creado_en DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_persona (id_persona),
    UNIQUE KEY uq_usuarios_nombre (nombre_usuario),
    CONSTRAINT fk_usuarios_persona FOREIGN KEY (id_persona) REFERENCES personas (id),
    CONSTRAINT fk_usuarios_rol FOREIGN KEY (id_rol) REFERENCES roles (id),
    CONSTRAINT ck_usuarios_activo CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE permisos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo VARCHAR(80) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_permisos_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE roles_permisos (
    id_rol BIGINT UNSIGNED NOT NULL,
    id_permiso BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id_rol, id_permiso),
    CONSTRAINT fk_roles_permisos_rol FOREIGN KEY (id_rol) REFERENCES roles (id),
    CONSTRAINT fk_roles_permisos_permiso FOREIGN KEY (id_permiso) REFERENCES permisos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE estudiantes (
    id_persona BIGINT UNSIGNED NOT NULL,
    codigo_estudiante VARCHAR(30) NOT NULL,
    fecha_nacimiento DATE NULL,
    activo BOOLEAN NOT NULL,
    PRIMARY KEY (id_persona),
    UNIQUE KEY uq_estudiantes_codigo (codigo_estudiante),
    CONSTRAINT fk_estudiantes_persona FOREIGN KEY (id_persona) REFERENCES personas (id),
    CONSTRAINT ck_estudiantes_activo CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE estudiantes_apoderados (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_estudiante BIGINT UNSIGNED NOT NULL,
    id_apoderado BIGINT UNSIGNED NOT NULL,
    vinculo VARCHAR(30) NOT NULL,
    es_principal BOOLEAN NOT NULL,
    vigente_desde DATE NOT NULL,
    vigente_hasta DATE NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_apoderados_periodo (id_estudiante, id_apoderado, vigente_desde),
    KEY ix_apoderados_persona_vigencia (id_apoderado, vigente_desde),
    CONSTRAINT fk_apoderados_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiantes (id_persona),
    CONSTRAINT fk_apoderados_persona FOREIGN KEY (id_apoderado) REFERENCES personas (id),
    CONSTRAINT ck_apoderados_personas CHECK (id_estudiante <> id_apoderado),
    CONSTRAINT ck_apoderados_principal CHECK (es_principal IN (0, 1)),
    CONSTRAINT ck_apoderados_periodo CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE aulas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    anio_lectivo SMALLINT UNSIGNED NOT NULL,
    nivel VARCHAR(20) NOT NULL,
    grado TINYINT UNSIGNED NOT NULL,
    seccion VARCHAR(20) NOT NULL,
    activo BOOLEAN NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_aulas_grupo (anio_lectivo, nivel, grado, seccion),
    CONSTRAINT ck_aulas_activo CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE matriculas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_estudiante BIGINT UNSIGNED NOT NULL,
    id_aula BIGINT UNSIGNED NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_matriculas_inicio (id_estudiante, fecha_inicio),
    UNIQUE KEY uq_matriculas_estudiante_id (id_estudiante, id),
    CONSTRAINT fk_matriculas_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiantes (id_persona),
    CONSTRAINT fk_matriculas_aula FOREIGN KEY (id_aula) REFERENCES aulas (id),
    CONSTRAINT ck_matriculas_periodo CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tipos_incidencia (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    categoria VARCHAR(30) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    minimo_estudiantes SMALLINT UNSIGNED NOT NULL,
    activo BOOLEAN NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tipos_categoria_nombre (categoria, nombre),
    CONSTRAINT ck_tipos_categoria CHECK (categoria IN (
        'convivencia', 'disciplina', 'salud', 'seguridad', 'bienes', 'proteccion_estudiantil'
    )),
    CONSTRAINT ck_tipos_activo CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE incidencias (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_registrador BIGINT UNSIGNED NOT NULL,
    id_rol_registrador BIGINT UNSIGNED NOT NULL,
    nombre_registrador VARCHAR(251) NOT NULL,
    registrada_en DATETIME(6) NOT NULL,
    confirmada_en DATETIME(6) NULL,
    estado VARCHAR(20) NOT NULL,
    prioridad VARCHAR(10) NOT NULL,
    confidencialidad VARCHAR(20) NOT NULL,
    id_version_vigente BIGINT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY ix_incidencias_estado_prioridad_fecha (estado, prioridad, registrada_en),
    CONSTRAINT fk_incidencias_registrador FOREIGN KEY (id_registrador) REFERENCES usuarios (id),
    CONSTRAINT fk_incidencias_rol FOREIGN KEY (id_rol_registrador) REFERENCES roles (id),
    CONSTRAINT ck_incidencias_estado CHECK (
        estado IN ('borrador', 'confirmada', 'en_seguimiento', 'cerrada', 'anulada')
    ),
    CONSTRAINT ck_incidencias_prioridad CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
    CONSTRAINT ck_incidencias_confidencialidad CHECK (confidencialidad IN ('interna', 'restringida')),
    CONSTRAINT ck_incidencias_confirmacion CHECK (
        (estado = 'borrador' AND confirmada_en IS NULL)
        OR (estado <> 'borrador' AND confirmada_en IS NOT NULL AND id_version_vigente IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE versiones_incidencia (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_incidencia BIGINT UNSIGNED NOT NULL,
    numero_version INT UNSIGNED NOT NULL,
    estado_version VARCHAR(20) NOT NULL,
    id_autor BIGINT UNSIGNED NOT NULL,
    creada_en DATETIME(6) NOT NULL,
    id_tipo BIGINT UNSIGNED NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    ocurrida_en DATETIME(6) NULL,
    lugar VARCHAR(255) NULL,
    id_reportante BIGINT UNSIGNED NOT NULL,
    condicion_reportante VARCHAR(20) NOT NULL,
    nombre_reportante VARCHAR(251) NOT NULL,
    gravedad_disciplinaria VARCHAR(20) NULL,
    ambito_convivencia VARCHAR(20) NULL,
    requiere_mediacion BOOLEAN NULL,
    norma_referida VARCHAR(100) NULL,
    sintomas_observados TEXT NULL,
    requiere_atencion_inmediata BOOLEAN NULL,
    riesgo_identificado TEXT NULL,
    riesgo_persistente BOOLEAN NULL,
    descripcion_dano TEXT NULL,
    monto_estimado DECIMAL(12,2) NULL,
    moneda CHAR(3) NULL,
    riesgo_inmediato BOOLEAN NULL,
    requiere_derivacion BOOLEAN NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_versiones_numero (id_incidencia, numero_version),
    UNIQUE KEY uq_versiones_incidencia_id (id_incidencia, id),
    CONSTRAINT fk_versiones_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id),
    CONSTRAINT fk_versiones_autor FOREIGN KEY (id_autor) REFERENCES usuarios (id),
    CONSTRAINT fk_versiones_tipo FOREIGN KEY (id_tipo) REFERENCES tipos_incidencia (id),
    CONSTRAINT fk_versiones_reportante FOREIGN KEY (id_reportante) REFERENCES personas (id),
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
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE involucrados (
    id_version BIGINT UNSIGNED NOT NULL,
    id_persona BIGINT UNSIGNED NOT NULL,
    id_matricula BIGINT UNSIGNED NULL,
    participacion VARCHAR(30) NOT NULL,
    PRIMARY KEY (id_version, id_persona),
    KEY ix_involucrados_persona_version (id_persona, id_version),
    CONSTRAINT fk_involucrados_version FOREIGN KEY (id_version) REFERENCES versiones_incidencia (id),
    CONSTRAINT fk_involucrados_persona FOREIGN KEY (id_persona) REFERENCES personas (id),
    CONSTRAINT fk_involucrados_persona_matricula FOREIGN KEY (id_persona, id_matricula)
        REFERENCES matriculas (id_estudiante, id),
    CONSTRAINT ck_involucrados_participacion CHECK (participacion IN ('afectado', 'testigo', 'involucrado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE actuaciones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_incidencia BIGINT UNSIGNED NOT NULL,
    id_autor BIGINT UNSIGNED NOT NULL,
    id_rol_autor BIGINT UNSIGNED NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    detalle TEXT NOT NULL,
    realizada_en DATETIME(6) NOT NULL,
    registrada_en DATETIME(6) NOT NULL,
    id_responsable BIGINT UNSIGNED NULL,
    fecha_limite DATE NULL,
    id_actuacion_corregida BIGINT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_actuaciones_incidencia_id (id_incidencia, id),
    KEY ix_actuaciones_incidencia_fecha (id_incidencia, registrada_en),
    CONSTRAINT fk_actuaciones_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id),
    CONSTRAINT fk_actuaciones_autor FOREIGN KEY (id_autor) REFERENCES usuarios (id),
    CONSTRAINT fk_actuaciones_rol FOREIGN KEY (id_rol_autor) REFERENCES roles (id),
    CONSTRAINT fk_actuaciones_responsable FOREIGN KEY (id_responsable) REFERENCES usuarios (id),
    CONSTRAINT fk_actuaciones_correccion FOREIGN KEY (id_incidencia, id_actuacion_corregida)
        REFERENCES actuaciones (id_incidencia, id),
    CONSTRAINT ck_actuaciones_tipo CHECK (tipo IN ('actuacion', 'observacion'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE solicitudes_cambio (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_incidencia BIGINT UNSIGNED NOT NULL,
    id_solicitante BIGINT UNSIGNED NOT NULL,
    id_rol_solicitante BIGINT UNSIGNED NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    justificacion TEXT NOT NULL,
    creada_en DATETIME(6) NOT NULL,
    estado VARCHAR(20) NOT NULL,
    id_version_base BIGINT UNSIGNED NOT NULL,
    id_version_propuesta BIGINT UNSIGNED NULL,
    confidencialidad_propuesta VARCHAR(20) NULL,
    motivo_anulacion VARCHAR(20) NULL,
    id_incidencia_duplicada BIGINT UNSIGNED NULL,
    id_evaluador BIGINT UNSIGNED NULL,
    evaluada_en DATETIME(6) NULL,
    requiere_revision BOOLEAN NULL,
    fundamento_revision VARCHAR(500) NULL,
    id_revision_resolutiva BIGINT UNSIGNED NULL,
    id_decisor BIGINT UNSIGNED NULL,
    id_rol_decisor BIGINT UNSIGNED NULL,
    fundamento_decision TEXT NULL,
    decidida_en DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_solicitudes_incidencia_id (id_incidencia, id),
    UNIQUE KEY uq_solicitudes_propuesta (id_version_propuesta),
    KEY ix_solicitudes_incidencia_estado (id_incidencia, estado),
    CONSTRAINT fk_solicitudes_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id),
    CONSTRAINT fk_solicitudes_solicitante FOREIGN KEY (id_solicitante) REFERENCES usuarios (id),
    CONSTRAINT fk_solicitudes_rol_solicitante FOREIGN KEY (id_rol_solicitante) REFERENCES roles (id),
    CONSTRAINT fk_solicitudes_base FOREIGN KEY (id_incidencia, id_version_base)
        REFERENCES versiones_incidencia (id_incidencia, id),
    CONSTRAINT fk_solicitudes_propuesta FOREIGN KEY (id_incidencia, id_version_propuesta)
        REFERENCES versiones_incidencia (id_incidencia, id),
    CONSTRAINT fk_solicitudes_duplicada FOREIGN KEY (id_incidencia_duplicada) REFERENCES incidencias (id),
    CONSTRAINT fk_solicitudes_evaluador FOREIGN KEY (id_evaluador) REFERENCES usuarios (id),
    CONSTRAINT fk_solicitudes_decisor FOREIGN KEY (id_decisor) REFERENCES usuarios (id),
    CONSTRAINT fk_solicitudes_rol_decisor FOREIGN KEY (id_rol_decisor) REFERENCES roles (id),
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
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE revisiones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_incidencia BIGINT UNSIGNED NOT NULL,
    id_solicitud BIGINT UNSIGNED NULL,
    id_responsable BIGINT UNSIGNED NOT NULL,
    motivo TEXT NOT NULL,
    abierta_en DATETIME(6) NOT NULL,
    cerrada_en DATETIME(6) NULL,
    estado VARCHAR(20) NOT NULL,
    requiere_reunion BOOLEAN NOT NULL,
    hubo_reunion BOOLEAN NOT NULL,
    reunion_en DATETIME(6) NULL,
    requiere_acta BOOLEAN NOT NULL,
    fundamento_acta VARCHAR(500) NOT NULL,
    acta TEXT NULL,
    id_emisor_acta BIGINT UNSIGNED NULL,
    acta_emitida_en DATETIME(6) NULL,
    conclusion TEXT NULL,
    id_revision_anterior BIGINT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_revisiones_incidencia_id (id_incidencia, id),
    UNIQUE KEY uq_revisiones_anterior (id_revision_anterior),
    CONSTRAINT fk_revisiones_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id),
    CONSTRAINT fk_revisiones_solicitud FOREIGN KEY (id_incidencia, id_solicitud)
        REFERENCES solicitudes_cambio (id_incidencia, id),
    CONSTRAINT fk_revisiones_responsable FOREIGN KEY (id_responsable) REFERENCES usuarios (id),
    CONSTRAINT fk_revisiones_emisor FOREIGN KEY (id_emisor_acta) REFERENCES usuarios (id),
    CONSTRAINT fk_revisiones_anterior FOREIGN KEY (id_incidencia, id_revision_anterior)
        REFERENCES revisiones (id_incidencia, id),
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
    CONSTRAINT ck_revisiones_periodo CHECK (cerrada_en IS NULL OR cerrada_en >= abierta_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE participantes_revision (
    id_revision BIGINT UNSIGNED NOT NULL,
    id_persona BIGINT UNSIGNED NOT NULL,
    funcion VARCHAR(40) NOT NULL,
    asistencia VARCHAR(15) NOT NULL,
    intervencion TEXT NULL,
    nombre_participante VARCHAR(251) NOT NULL,
    PRIMARY KEY (id_revision, id_persona),
    CONSTRAINT fk_participantes_revision FOREIGN KEY (id_revision) REFERENCES revisiones (id),
    CONSTRAINT fk_participantes_persona FOREIGN KEY (id_persona) REFERENCES personas (id),
    CONSTRAINT ck_participantes_asistencia CHECK (asistencia IN ('pendiente', 'asistio', 'ausente'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Antes de historial porque sus eventos pueden referenciar un conflicto.
CREATE TABLE conflictos_interes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_incidencia BIGINT UNSIGNED NOT NULL,
    id_usuario_afectado BIGINT UNSIGNED NOT NULL,
    id_declarante BIGINT UNSIGNED NOT NULL,
    motivo TEXT NOT NULL,
    declarado_en DATETIME(6) NOT NULL,
    estado VARCHAR(20) NOT NULL,
    id_resolutor BIGINT UNSIGNED NULL,
    resuelto_en DATETIME(6) NULL,
    fundamento_resolucion TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_conflictos_incidencia_id (id_incidencia, id),
    KEY ix_conflictos_incidencia_usuario_estado (id_incidencia, id_usuario_afectado, estado),
    CONSTRAINT fk_conflictos_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id),
    CONSTRAINT fk_conflictos_usuario FOREIGN KEY (id_usuario_afectado) REFERENCES usuarios (id),
    CONSTRAINT fk_conflictos_declarante FOREIGN KEY (id_declarante) REFERENCES usuarios (id),
    CONSTRAINT fk_conflictos_resolutor FOREIGN KEY (id_resolutor) REFERENCES usuarios (id),
    CONSTRAINT ck_conflictos_estado CHECK (estado IN ('pendiente', 'inhibido', 'descartado')),
    CONSTRAINT ck_conflictos_resolucion CHECK (
        (id_resolutor IS NULL AND resuelto_en IS NULL AND fundamento_resolucion IS NULL AND estado <> 'descartado')
        OR (id_resolutor IS NOT NULL AND resuelto_en IS NOT NULL AND fundamento_resolucion IS NOT NULL
            AND id_resolutor <> id_usuario_afectado AND estado <> 'pendiente')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE historial (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_actor BIGINT UNSIGNED NOT NULL,
    id_rol_actor BIGINT UNSIGNED NOT NULL,
    ocurrido_en DATETIME(6) NOT NULL,
    accion VARCHAR(60) NOT NULL,
    id_incidencia BIGINT UNSIGNED NULL,
    id_persona BIGINT UNSIGNED NULL,
    id_usuario_afectado BIGINT UNSIGNED NULL,
    id_rol_afectado BIGINT UNSIGNED NULL,
    id_permiso BIGINT UNSIGNED NULL,
    id_vinculo_apoderado BIGINT UNSIGNED NULL,
    id_aula BIGINT UNSIGNED NULL,
    id_matricula BIGINT UNSIGNED NULL,
    id_tipo_incidencia BIGINT UNSIGNED NULL,
    id_version BIGINT UNSIGNED NULL,
    id_estudiante BIGINT UNSIGNED NULL,
    id_actuacion BIGINT UNSIGNED NULL,
    id_solicitud BIGINT UNSIGNED NULL,
    id_revision BIGINT UNSIGNED NULL,
    id_conflicto BIGINT UNSIGNED NULL,
    id_rol_anterior BIGINT UNSIGNED NULL,
    id_rol_nuevo BIGINT UNSIGNED NULL,
    campo VARCHAR(60) NULL,
    valor_anterior TEXT NULL,
    valor_nuevo TEXT NULL,
    motivo TEXT NULL,
    PRIMARY KEY (id),
    KEY ix_historial_incidencia_fecha (id_incidencia, ocurrido_en),
    CONSTRAINT fk_historial_actor FOREIGN KEY (id_actor) REFERENCES usuarios (id),
    CONSTRAINT fk_historial_rol_actor FOREIGN KEY (id_rol_actor) REFERENCES roles (id),
    CONSTRAINT fk_historial_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencias (id),
    CONSTRAINT fk_historial_persona FOREIGN KEY (id_persona) REFERENCES personas (id),
    CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario_afectado) REFERENCES usuarios (id),
    CONSTRAINT fk_historial_rol FOREIGN KEY (id_rol_afectado) REFERENCES roles (id),
    CONSTRAINT fk_historial_permiso FOREIGN KEY (id_permiso) REFERENCES permisos (id),
    CONSTRAINT fk_historial_apoderado FOREIGN KEY (id_vinculo_apoderado) REFERENCES estudiantes_apoderados (id),
    CONSTRAINT fk_historial_aula FOREIGN KEY (id_aula) REFERENCES aulas (id),
    CONSTRAINT fk_historial_matricula FOREIGN KEY (id_matricula) REFERENCES matriculas (id),
    CONSTRAINT fk_historial_tipo FOREIGN KEY (id_tipo_incidencia) REFERENCES tipos_incidencia (id),
    CONSTRAINT fk_historial_version FOREIGN KEY (id_version) REFERENCES versiones_incidencia (id),
    CONSTRAINT fk_historial_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiantes (id_persona),
    CONSTRAINT fk_historial_actuacion FOREIGN KEY (id_actuacion) REFERENCES actuaciones (id),
    CONSTRAINT fk_historial_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes_cambio (id),
    CONSTRAINT fk_historial_revision FOREIGN KEY (id_revision) REFERENCES revisiones (id),
    CONSTRAINT fk_historial_conflicto FOREIGN KEY (id_conflicto) REFERENCES conflictos_interes (id),
    CONSTRAINT fk_historial_rol_anterior FOREIGN KEY (id_rol_anterior) REFERENCES roles (id),
    CONSTRAINT fk_historial_rol_nuevo FOREIGN KEY (id_rol_nuevo) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Cerrar ciclos del DDL sin desactivar integridad referencial.
-- Para registrar: crear incidencia borrador con puntero NULL, crear versión,
-- asignar puntero y confirmar dentro de la misma transacción del backend.
ALTER TABLE incidencias
    ADD CONSTRAINT fk_incidencias_version_vigente
    FOREIGN KEY (id, id_version_vigente)
    REFERENCES versiones_incidencia (id_incidencia, id);

-- Crear solicitud sin revisión resolutiva; crear/concluir la revisión y luego
-- asignar la referencia al resolver. Backend verifica misma solicitud concreta.
ALTER TABLE solicitudes_cambio
    ADD CONSTRAINT fk_solicitudes_revision_resolutiva
    FOREIGN KEY (id_incidencia, id_revision_resolutiva)
    REFERENCES revisiones (id_incidencia, id);
