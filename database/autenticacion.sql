-- Tablas técnicas necesarias para autenticación; no modifican las 19 del modelo.
CREATE TABLE sesiones (
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    credencial_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    creada_en DATETIME(6) NOT NULL,
    ultima_actividad_en DATETIME(6) NOT NULL,
    vence_en DATETIME(6) NOT NULL,
    PRIMARY KEY (token_hash),
    KEY ix_sesiones_vencimiento (vence_en),
    CONSTRAINT fk_sesiones_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Claves SHA-256 de IP o nombre de cuenta; nunca contraseñas ni cookies.
CREATE TABLE intentos_acceso (
    clave CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cantidad INT UNSIGNED NOT NULL,
    vence_en DATETIME(6) NOT NULL,
    PRIMARY KEY (clave),
    KEY ix_intentos_vencimiento (vence_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
