-- Amplía la tabla existente; las autorizaciones anteriores conservan sus datos.
ALTER TABLE autorizaciones_cuentas
    MODIFY id_autorizante BIGINT UNSIGNED NULL,
    MODIFY id_rol_autorizante BIGINT UNSIGNED NULL,
    MODIFY autorizada_en DATETIME(6) NULL,
    ADD id_solicitante BIGINT UNSIGNED NULL,
    ADD id_rol_solicitante BIGINT UNSIGNED NULL,
    ADD solicitada_en DATETIME(6) NULL,
    ADD estado VARCHAR(30) NOT NULL DEFAULT 'legado',
    ADD revision_doble BOOLEAN NOT NULL DEFAULT 0,
    ADD id_decisor_director BIGINT UNSIGNED NULL,
    ADD decision_director VARCHAR(10) NULL,
    ADD fundamento_director VARCHAR(500) NULL,
    ADD decidida_director_en DATETIME(6) NULL,
    ADD id_decisor_subdirector BIGINT UNSIGNED NULL,
    ADD decision_subdirector VARCHAR(10) NULL,
    ADD fundamento_subdirector VARCHAR(500) NULL,
    ADD decidida_subdirector_en DATETIME(6) NULL,
    ADD CONSTRAINT fk_autcuenta_solicitante FOREIGN KEY (id_solicitante) REFERENCES usuarios (id),
    ADD CONSTRAINT fk_autcuenta_rol_solicitante FOREIGN KEY (id_rol_solicitante) REFERENCES roles (id),
    ADD CONSTRAINT fk_autcuenta_decisor_d FOREIGN KEY (id_decisor_director) REFERENCES usuarios (id),
    ADD CONSTRAINT fk_autcuenta_decisor_sd FOREIGN KEY (id_decisor_subdirector) REFERENCES usuarios (id),
    DROP CHECK ck_autcuenta_tipo,
    ADD CONSTRAINT ck_autcuenta_tipo CHECK (tipo IN (
        'crear_cuenta', 'actualizar_cuenta', 'editar_cuenta', 'activar_cuenta', 'desactivar_cuenta',
        'restablecer_clave', 'cambiar_rol', 'asignar_permiso', 'retirar_permiso')),
    ADD CONSTRAINT ck_autcuenta_estado CHECK (estado IN ('legado', 'pendiente', 'aprobada', 'rechazada', 'desacuerdo', 'ejecutada')),
    ADD CONSTRAINT ck_autcuenta_solicitud CHECK (estado = 'legado' OR (id_solicitante IS NOT NULL AND id_rol_solicitante IS NOT NULL AND solicitada_en IS NOT NULL)),
    ADD CONSTRAINT ck_autcuenta_doble CHECK (revision_doble IN (0, 1)),
    ADD CONSTRAINT ck_autcuenta_decision_d CHECK (
        (id_decisor_director IS NULL AND decision_director IS NULL AND fundamento_director IS NULL AND decidida_director_en IS NULL)
        OR (id_decisor_director IS NOT NULL AND decision_director IS NOT NULL AND decision_director IN ('aprobar', 'rechazar')
            AND fundamento_director IS NOT NULL AND decidida_director_en IS NOT NULL AND id_decisor_director <> id_solicitante)),
    ADD CONSTRAINT ck_autcuenta_decision_sd CHECK (
        (id_decisor_subdirector IS NULL AND decision_subdirector IS NULL AND fundamento_subdirector IS NULL AND decidida_subdirector_en IS NULL)
        OR (id_decisor_subdirector IS NOT NULL AND decision_subdirector IS NOT NULL AND decision_subdirector IN ('aprobar', 'rechazar')
            AND fundamento_subdirector IS NOT NULL AND decidida_subdirector_en IS NOT NULL AND id_decisor_subdirector <> id_solicitante)),
    ADD CONSTRAINT ck_autcuenta_aprobada CHECK (estado NOT IN ('aprobada', 'ejecutada') OR (id_autorizante IS NOT NULL AND autorizada_en IS NOT NULL)),
    ADD CONSTRAINT ck_autcuenta_ejecutada CHECK (estado <> 'ejecutada' OR (id_ejecutor IS NOT NULL AND ejecutada_en IS NOT NULL));
