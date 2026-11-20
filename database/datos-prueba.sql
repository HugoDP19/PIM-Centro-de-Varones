-- Datos ficticios de SICE. Ejecutar una vez sobre una copia vacia del esquema.

-- Usar un cliente que se detenga al primer error. Las cuentas de ejemplo estan desactivadas.

START TRANSACTION;

-- roles

INSERT INTO roles (id, codigo, nombre) VALUES
  (1, 'director', 'Director'),
  (2, 'subdirector', 'Subdirector'),
  (3, 'coordinador_tutoria', 'Coordinador de Tutoria'),
  (4, 'docente', 'Docente'),
  (5, 'auxiliar', 'Auxiliar'),
  (6, 'administrador', 'Administrador');

-- personas

INSERT INTO personas (id, codigo_interno, nombres, apellidos, es_personal, activo) VALUES
  (1, 'PER-001', 'Rafael', 'Salas', 1, 1),
  (2, 'PER-002', 'Elena', 'Ortiz', 1, 1),
  (3, 'PER-003', 'Marco', 'Rivas', 1, 1),
  (4, 'PER-004', 'Lucia', 'Torres', 1, 1),
  (5, 'PER-005', 'Carlos', 'Vega', 1, 1),
  (6, 'PER-006', 'Andrea', 'Luna', 1, 1),
  (7, 'EST-001', 'Diego Alonso', 'Vargas Mendoza', 0, 1),
  (8, 'EST-002', 'Mateo Andres', 'Quispe Flores', 0, 1),
  (9, 'EST-003', 'Luis Gabriel', 'Torres Salazar', 0, 1);

-- usuarios

INSERT INTO usuarios (id, id_persona, id_rol, nombre_usuario, contrasena_hash, activo, creado_en) VALUES
  (1, 1, 1, 'aula_director', 'scrypt$131072$8$1$7e0d13870cbda6a14f19d4c9f4665775$2c029ad9c1693b270d1db25c5a8a898c95f58ec59ed7f5623ce6f3dc328d04ab8074fcd9fcf802e851703e169abbf368ba3ac4795926f2df4db38f42c066b2b2', 0, '2026-11-20 08:00:00'),
  (2, 2, 2, 'aula_subdirector', 'scrypt$131072$8$1$a163b2b92c1429ccc0ce3c9cc70e5bc3$a3e48bfd2611a84972933b2322b800bf779da15c42c9b0ac5971debb43bb8e43d9f6ec31bb63435e1179fe644cc6c36a470b9e877803aa0dcfd29c9c047c006c', 0, '2026-11-20 08:00:00'),
  (3, 3, 3, 'aula_coordinador_tutoria', 'scrypt$131072$8$1$abdcaa5443935ea25a1f33cf0646710b$8fd43ade6575b74e01ef9fdbdab65180c7187cb722e21c6c9093ee558a3e15f2bf31a16f79cc83c9c59ce0fb27370d78a09d439a111429b2577ff694b9d40705', 0, '2026-11-20 08:00:00'),
  (4, 4, 4, 'aula_docente', 'scrypt$131072$8$1$d7f3fb25589fe66643e0d4900524ae4a$f78f6650c1f0d9235f741b6f2f90590040466b1742fe4022488335621854572b0e4089d62f78123da1bc3075dcdd7fff3ede8d1304684a0694be4c8b1c31ce0d', 0, '2026-11-20 08:00:00'),
  (5, 5, 5, 'aula_auxiliar', 'scrypt$131072$8$1$71db18a99cec22a702b8b4271050b324$c25eb446ae49c6e60936038c2a9ec807a9881ee7e3a4e46667d5fe02e2f40278263a73dec4157fe9352e6548943f63ab60f037f829fa911bfd84be97030bbbb4', 0, '2026-11-20 08:00:00'),
  (6, 6, 6, 'aula_administrador', 'scrypt$131072$8$1$3793f996b9216ca3b3ac70f9f813f9ce$ac2952ebad135f26324275aec5629a1987476d7cd4cdbed9d6916d0b3d109f11727613d7731794b13102708c80f64b6c935c012ec67737485c301657684ac899', 0, '2026-11-20 08:00:00');

-- permisos

INSERT INTO permisos (id, codigo, descripcion) VALUES
  (1, 'sesion.consultar', 'sesion.consultar'),
  (2, 'cuentas.consultar', 'cuentas.consultar'),
  (3, 'cuentas.administrar', 'cuentas.administrar'),
  (4, 'cuentas.autorizar', 'cuentas.autorizar'),
  (5, 'cuentas.solicitar', 'cuentas.solicitar'),
  (6, 'cuentas.ejecutar', 'cuentas.ejecutar'),
  (7, 'incidencias.registrar', 'incidencias.registrar'),
  (8, 'incidencias.consultar', 'incidencias.consultar'),
  (9, 'incidencias.seguimiento', 'incidencias.seguimiento'),
  (10, 'incidencias.solicitar', 'incidencias.solicitar'),
  (11, 'incidencias.resolver', 'incidencias.resolver'),
  (12, 'incidencias.cerrar', 'incidencias.cerrar'),
  (13, 'estudiantes.crear', 'estudiantes.crear'),
  (14, 'incidencias.exportar', 'incidencias.exportar'),
  (15, 'incidencias.restringidas', 'incidencias.restringidas');

-- roles_permisos

INSERT INTO roles_permisos (id_rol, id_permiso) VALUES
  (1, 1),
  (2, 1),
  (3, 1),
  (4, 1),
  (5, 1),
  (6, 1),
  (1, 2),
  (2, 2),
  (6, 2),
  (6, 3),
  (1, 4),
  (2, 4),
  (1, 5),
  (2, 5),
  (6, 5),
  (1, 6),
  (2, 6),
  (6, 6),
  (1, 7),
  (2, 7),
  (3, 7),
  (4, 7),
  (5, 7),
  (1, 8),
  (2, 8),
  (3, 8),
  (4, 8),
  (5, 8),
  (1, 9),
  (2, 9),
  (3, 9),
  (4, 9),
  (5, 9),
  (1, 10),
  (2, 10),
  (3, 10),
  (4, 10),
  (5, 10),
  (1, 11),
  (2, 11),
  (1, 12),
  (2, 12),
  (3, 12),
  (1, 13),
  (2, 13),
  (3, 13),
  (1, 14),
  (2, 14),
  (3, 14),
  (4, 14),
  (5, 14),
  (1, 15),
  (2, 15);

-- estudiantes

INSERT INTO estudiantes (id_persona, codigo_estudiante, activo) VALUES
  (7, 'EST-001', 1),
  (8, 'EST-002', 1),
  (9, 'EST-003', 1);

-- aulas

INSERT INTO aulas (id, anio_lectivo, nivel, grado, seccion, activo) VALUES
  (1, 2026, 'primaria', 5, 'A', 1);

-- matriculas

INSERT INTO matriculas (id, id_estudiante, id_aula, fecha_inicio) VALUES
  (1, 7, 1, '2026-01-01'),
  (2, 8, 1, '2026-03-02'),
  (3, 9, 1, '2026-03-02');

-- tipos_incidencia

INSERT INTO tipos_incidencia (id, categoria, nombre, minimo_estudiantes, activo) VALUES
  (1, 'convivencia', 'Desacuerdo por los turnos', 1, 1),
  (2, 'disciplina', 'Interrupcion durante la lectura', 1, 1),
  (3, 'salud', 'Malestar durante la clase', 1, 1),
  (4, 'seguridad', 'Baldosa suelta en el patio', 0, 1),
  (5, 'bienes', 'Material de aula deteriorado', 1, 1),
  (6, 'proteccion_estudiantil', 'Solicitud de apoyo en tutoria', 1, 1);

-- incidencias

INSERT INTO incidencias (id, id_registrador, id_rol_registrador, nombre_registrador, registrada_en, estado, prioridad, confidencialidad) VALUES
  (1, 4, 4, 'Lucia Torres', '2026-11-20 09:00:00', 'borrador', 'normal', 'interna'),
  (2, 4, 4, 'Lucia Torres', '2026-11-20 09:00:00', 'borrador', 'normal', 'interna'),
  (3, 4, 4, 'Lucia Torres', '2026-11-20 09:00:00', 'borrador', 'normal', 'restringida'),
  (4, 4, 4, 'Lucia Torres', '2026-11-20 09:00:00', 'borrador', 'normal', 'interna'),
  (5, 4, 4, 'Lucia Torres', '2026-11-20 09:00:00', 'borrador', 'normal', 'interna'),
  (6, 4, 4, 'Lucia Torres', '2026-11-20 09:00:00', 'borrador', 'normal', 'restringida');

-- versiones_incidencia

INSERT INTO versiones_incidencia (id, id_incidencia, numero_version, estado_version, id_autor, creada_en, id_tipo, titulo, descripcion, id_reportante, condicion_reportante, nombre_reportante) VALUES
  (1, 1, 1, 'borrador', 4, '2026-11-20 09:00:00', 1, 'Desacuerdo por los turnos', 'Se acordaron turnos para compartir el material.', 4, 'personal', 'Lucia Torres'),
  (2, 2, 1, 'borrador', 4, '2026-11-20 09:00:00', 2, 'Interrupcion durante la lectura', 'El docente recordo las normas del aula.', 4, 'personal', 'Lucia Torres'),
  (3, 3, 1, 'borrador', 4, '2026-11-20 09:00:00', 3, 'Malestar durante la clase', 'Se acompano al estudiante al espacio de atencion.', 4, 'personal', 'Lucia Torres'),
  (4, 4, 1, 'borrador', 4, '2026-11-20 09:00:00', 4, 'Baldosa suelta en el patio', 'Se senalizo el lugar y se aviso al encargado.', 4, 'personal', 'Lucia Torres'),
  (5, 5, 1, 'borrador', 4, '2026-11-20 09:00:00', 5, 'Material de aula deteriorado', 'Se registro el desgaste del material compartido.', 4, 'personal', 'Lucia Torres'),
  (6, 6, 1, 'borrador', 4, '2026-11-20 09:00:00', 6, 'Solicitud de apoyo en tutoria', 'Tutoria recibio una solicitud de acompanamiento.', 4, 'personal', 'Lucia Torres');

-- Cada expediente apunta a su version una vez insertados ambos registros.

UPDATE incidencias SET id_version_vigente = id WHERE id IN (1, 2, 3, 4, 5, 6);

-- involucrados

INSERT INTO involucrados (id_version, id_persona, id_matricula, participacion) VALUES
  (1, 7, 1, 'involucrado'),
  (2, 8, 2, 'involucrado'),
  (3, 9, 3, 'involucrado'),
  (5, 8, 2, 'involucrado'),
  (6, 9, 3, 'involucrado');

-- historial

INSERT INTO historial (id_actor, id_rol_actor, ocurrido_en, accion, id_incidencia, id_version) VALUES
  (4, 4, '2026-11-20 09:00:00', 'borrador_creado', 1, 1),
  (4, 4, '2026-11-20 09:00:00', 'borrador_creado', 2, 2),
  (4, 4, '2026-11-20 09:00:00', 'borrador_creado', 3, 3),
  (4, 4, '2026-11-20 09:00:00', 'borrador_creado', 4, 4),
  (4, 4, '2026-11-20 09:00:00', 'borrador_creado', 5, 5),
  (4, 4, '2026-11-20 09:00:00', 'borrador_creado', 6, 6);

COMMIT;
