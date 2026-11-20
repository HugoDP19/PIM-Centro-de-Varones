-- Flujo concreto autorizado para desarrollo. No guarda contraseñas ni JSON.
CREATE TABLE autorizaciones_cuentas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tipo VARCHAR(30) NOT NULL,
    id_usuario_objetivo BIGINT UNSIGNED NULL,
    id_persona BIGINT UNSIGNED NULL,
    id_rol_objetivo BIGINT UNSIGNED NULL,
    id_permiso BIGINT UNSIGNED NULL,
    nombre_usuario VARCHAR(60) NULL,
    activo BOOLEAN NULL,
    huella_objetivo CHAR(64) NULL,
    id_autorizante BIGINT UNSIGNED NOT NULL,
    id_rol_autorizante BIGINT UNSIGNED NOT NULL,
    motivo VARCHAR(500) NOT NULL,
    autorizada_en DATETIME(6) NOT NULL,
    vence_en DATETIME(6) NOT NULL,
    id_ejecutor BIGINT UNSIGNED NULL,
    ejecutada_en DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_autcuenta_usuario FOREIGN KEY (id_usuario_objetivo) REFERENCES usuarios (id),
    CONSTRAINT fk_autcuenta_persona FOREIGN KEY (id_persona) REFERENCES personas (id),
    CONSTRAINT fk_autcuenta_rol FOREIGN KEY (id_rol_objetivo) REFERENCES roles (id),
    CONSTRAINT fk_autcuenta_permiso FOREIGN KEY (id_permiso) REFERENCES permisos (id),
    CONSTRAINT fk_autcuenta_autor FOREIGN KEY (id_autorizante) REFERENCES usuarios (id),
    CONSTRAINT fk_autcuenta_rol_autor FOREIGN KEY (id_rol_autorizante) REFERENCES roles (id),
    CONSTRAINT fk_autcuenta_ejecutor FOREIGN KEY (id_ejecutor) REFERENCES usuarios (id),
    CONSTRAINT ck_autcuenta_tipo CHECK (
        tipo IN ('crear_cuenta', 'actualizar_cuenta', 'restablecer_clave', 'asignar_permiso', 'retirar_permiso')
    ),
    CONSTRAINT ck_autcuenta_activo CHECK (activo IS NULL OR activo IN (0, 1)),
    CONSTRAINT ck_autcuenta_ejecucion CHECK (
        (id_ejecutor IS NULL AND ejecutada_en IS NULL)
        OR (id_ejecutor IS NOT NULL AND ejecutada_en IS NOT NULL AND id_ejecutor <> id_autorizante)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
