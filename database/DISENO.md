# SICE-Local: propuesta de modelo relacional

Fase 2.1 · 30 de octubre de 2026 · Propuesta pendiente de revisión.

Institución: I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete.

Este documento propone **25 tablas** para MySQL 8. No crea tablas, migraciones, datos de demostración ni código de acceso a datos. Los requisitos de seguridad descritos son obligaciones de la implementación futura, no capacidades ya disponibles.

## 1. Convenciones

- Tablas y columnas en español, minúsculas y snake_case, sin tildes. Motor InnoDB y texto utf8mb4.
- `id` significa `BIGINT UNSIGNED`, clave primaria autoincremental, salvo claves compuestas indicadas. Las referencias usan el mismo tipo que la clave destino.
- `FK` indica clave foránea; `UQ`, unicidad; `?`, campo opcional que admite NULL. Los demás campos son obligatorios. Las claves FK apuntan al `id` de la tabla indicada salvo aclaración.
- Fechas civiles: `DATE`. Instantes: `DATETIME(6)` en UTC generados por el servidor; presentación en America/Lima. La fecha de ocurrencia es declarada y puede ser desconocida; no se confunde con la fecha automática de registro.
- `BOOLEAN` para indicadores con valores 0 o 1; `VARCHAR` para textos breves y códigos; `TEXT` para descripciones. No usar números para documentos de identidad ni teléfonos.
- Los estados de flujos internos usan códigos `VARCHAR(20)` restringidos a los valores indicados. No requieren tablas adicionales si no son configurables.
- `activo` permite deshabilitar maestros sin romper relaciones históricas. No se usan borrados en cascada sobre datos de incidencias.

## 2. Tablas y columnas principales

### Identidad y autorización (1–6)

| N.º | Tabla y finalidad | Columnas principales |
| --- | --- | --- |
| 1 | `personas`: identidad común de personal, estudiantes, apoderados y externos, sin duplicar una persona por cada condición | `id`; `nombres VARCHAR(100)`; `apellidos VARCHAR(150)`; `tipo_documento VARCHAR(20)?`; `numero_documento VARCHAR(40)?`; `pais_documento CHAR(2)?`; `codigo_interno VARCHAR(30) UQ`; `es_personal BOOLEAN`; `telefono VARCHAR(30)?`; `correo VARCHAR(254)?`; `activo BOOLEAN` |
| 2 | `roles`: seis perfiles institucionales fijos | `id`; `codigo VARCHAR(30) UQ`; `nombre VARCHAR(60) UQ` |
| 3 | `usuarios`: cuentas del personal | `id`; `id_persona FK personas UQ`; `id_rol FK roles`; `nombre_usuario VARCHAR(60) UQ`; `contrasena_hash VARCHAR(255)`; `activo BOOLEAN`; `creado_en DATETIME(6)` |
| 4 | `permisos`: catálogo técnico de acciones autorizables | `id`; `codigo VARCHAR(80) UQ`; `descripcion VARCHAR(255)` |
| 5 | `roles_permisos`: permisos base concedidos a cada rol | `id_rol FK roles`; `id_permiso FK permisos`; PK compuesta `(id_rol, id_permiso)` |
| 6 | `usuarios_permisos`: excepciones explícitas por usuario | `id_usuario FK usuarios`; `id_permiso FK permisos`; `permitido BOOLEAN`; `id_asignador FK usuarios`; `asignado_en DATETIME(6)`; `justificacion VARCHAR(500)`; PK compuesta `(id_usuario, id_permiso)` |

Roles: Director, Subdirector, Coordinador de Tutoría, Docente, Auxiliar y Administrador. Se propone un rol vigente por usuario; el rol ejercido al registrar o decidir se conserva como dato histórico. No se deduce autoridad a partir del orden o del número del rol.

El permiso efectivo parte del rol y admite una excepción de usuario. Por encima de ambos se aplican las restricciones obligatorias: confidencialidad, conflicto de interés, independencia y prohibiciones del Administrador. Un permiso configurable nunca las anula. El Administrador administra cuentas y permisos dentro de un conjunto autorizado; no registra, rectifica, anula, aprueba ni agrega seguimiento a incidencias. Cambiar el rol de una cuenta no permite aprobar solicitudes propias. Los cambios de permisos y roles se auditan.

### Organización escolar (7–10)

| N.º | Tabla y finalidad | Columnas principales |
| --- | --- | --- |
| 7 | `estudiantes`: condición de estudiante de una persona | `id_persona FK personas`, también PK; `codigo_estudiante VARCHAR(30) UQ`; `fecha_nacimiento DATE?`; `activo BOOLEAN` |
| 8 | `estudiantes_apoderados`: relación entre estudiantes y personas responsables | `id_estudiante FK estudiantes(id_persona)`; `id_apoderado FK personas`; `vinculo VARCHAR(40)`; `es_principal BOOLEAN`; `vigente_desde DATE`; `vigente_hasta DATE?`; PK compuesta `(id_estudiante, id_apoderado, vigente_desde)` |
| 9 | `aulas`: grupos por año lectivo | `id`; `anio_lectivo SMALLINT UNSIGNED`; `nivel VARCHAR(20)`; `grado TINYINT UNSIGNED`; `seccion VARCHAR(20)`; `activo BOOLEAN`; UQ `(anio_lectivo, nivel, grado, seccion)` |
| 10 | `matriculas`: pertenencia histórica de un estudiante a un aula | `id`; `id_estudiante FK estudiantes(id_persona)`; `id_aula FK aulas`; `fecha_inicio DATE`; `fecha_fin DATE?`; UQ `(id_estudiante, id_aula, fecha_inicio)` |

No se necesita una tabla `apoderados` que solo replique personas: la condición queda expresada por `estudiantes_apoderados`. Una persona puede ser personal y apoderado a la vez. Los estudiantes del colegio son varones; no se extiende esta restricción al resto de personas ni se almacena una columna constante de sexo en estudiantes.

La identidad admite DNI, carné de extranjería, pasaporte u otro documento autorizado, con país emisor. Los tres campos documentales se completan juntos o permanecen juntos en NULL. UQ `(pais_documento, tipo_documento, numero_documento)` cuando se conocen; normalizar formato antes de guardar. El código interno obligatorio identifica también a extranjeros sin DNI y a personas sin documento aún verificado: no inventar un DNI ni usar valores ficticios. La identidad provisional requiere revisión de duplicados.

### Clasificación e incidencias (11–17)

| N.º | Tabla y finalidad | Columnas principales |
| --- | --- | --- |
| 11 | `categorias_incidencia`: clasificación general | `id`; `nombre VARCHAR(60) UQ`; `activo BOOLEAN` |
| 12 | `tipos_incidencia`: clasificación específica dentro de una categoría | `id`; `id_categoria FK categorias_incidencia`; `nombre VARCHAR(100)`; `minimo_estudiantes SMALLINT UNSIGNED`; `activo BOOLEAN`; UQ `(id_categoria, nombre)` |
| 13 | `estados_incidencia`: estados operativos con significado fijo | `id`; `codigo VARCHAR(30) UQ`; `nombre VARCHAR(60)` |
| 14 | `prioridades_incidencia`: urgencia de atención | `id`; `codigo VARCHAR(20) UQ`; `nombre VARCHAR(40)`; `orden TINYINT UNSIGNED UQ` |
| 15 | `incidencias`: identidad estable, autoría inicial y estado operativo | `id`; `id_registrador FK usuarios`; `id_rol_registrador FK roles`; `nombre_registrador VARCHAR(251)` histórico; `registrada_en DATETIME(6)`; `confirmada_en DATETIME(6)?`; `id_estado FK estados_incidencia`; `id_prioridad FK prioridades_incidencia`; `id_version_vigente BIGINT UNSIGNED?`; `nivel_confidencialidad VARCHAR(20)` |
| 16 | `versiones_incidencia`: contenido del borrador, propuesta o hechos confirmados | `id`; `id_incidencia FK incidencias`; `numero_version INT UNSIGNED`; `estado_version VARCHAR(20)`; `id_autor FK usuarios`; `creada_en DATETIME(6)`; `id_tipo FK tipos_incidencia`; `titulo VARCHAR(200)`; `descripcion TEXT`; `ocurrida_en DATETIME(6)?`; `lugar VARCHAR(255)?`; `id_reportante FK personas`; `condicion_reportante VARCHAR(20)`; `nombre_reportante VARCHAR(251)` histórico; `gravedad_disciplinaria VARCHAR(20)?`; UQ `(id_incidencia, numero_version)` y `(id_incidencia, id)` |
| 17 | `versiones_estudiantes`: estudiantes involucrados en cada versión, con su contexto escolar | `id_version FK versiones_incidencia`; `id_estudiante FK estudiantes(id_persona)`; `id_matricula BIGINT UNSIGNED?`; `participacion VARCHAR(30)`; PK compuesta `(id_version, id_estudiante)` |

Categorías previstas: Convivencia, Disciplina, Salud, Seguridad, Bienes y Protección estudiantil. La categoría se obtiene por el tipo; no se duplica en la incidencia. Los tipos usados históricamente se desactivan; no se reasignan a otra categoría.

Estados operativos propuestos: `borrador`, `confirmada`, `en_seguimiento`, `cerrada`, `anulada`. Prioridades propuestas: baja, normal, alta y urgente. Gravedad disciplinaria: NULL cuando no aplica, o `por_evaluar`, `leve`, `grave`, `muy_grave`, pendiente de validación institucional. La urgencia no se deriva de la gravedad; una incidencia de salud puede ser urgente sin tener gravedad disciplinaria.

La prioridad y el estado pueden cambiar con autorización y auditoría sin reescribir los hechos. La clasificación, el reportante, la gravedad y los estudiantes forman parte de la versión; cambiar cualquiera tras confirmar exige rectificación. La confidencialidad usa `interna` o `restringida`: elevarla es una acción protectora auditada; reducirla requiere autorización independiente y motivo, mediante una solicitud de rectificación con el nivel propuesto explícito.

El reportante es obligatorio al confirmar y se propone una persona por versión; `condicion_reportante` indica cómo reportó: `personal`, `estudiante`, `apoderado` o `externo`. No implica tener cuenta. Se valida esa condición contra usuarios/personas, estudiantes o la relación de apoderados según corresponda. La condición y el nombre se conservan como hechos históricos; los teléfonos y documentos no se copian en cada versión. Los nombres históricos son la excepción justificada a la derivación por relaciones.

Una versión puede tener **cero, uno o varios estudiantes**; no existe una obligación global de registrar dos. Al confirmar se verifica el mínimo del tipo. La participación describe el vínculo con el hecho, sin presumir responsabilidad: por ejemplo involucrado, afectado o testigo; vocabulario por acordar.

`id_matricula` puede ser NULL cuando no se conoce el aula histórica; si existe, debe corresponder al mismo estudiante, mediante FK compuesta `(id_estudiante, id_matricula)` hacia una clave UQ equivalente en matriculas. No se infiere el aula histórica desde la matrícula vigente hoy.

### Seguimiento y control de cambios (18–20)

| N.º | Tabla y finalidad | Columnas principales |
| --- | --- | --- |
| 18 | `actuaciones`: acciones y observaciones autorizadas de seguimiento | `id`; `id_incidencia FK incidencias`; `id_autor FK usuarios`; `id_rol_autor FK roles`; `tipo VARCHAR(20)` (`actuacion` u `observacion`); `detalle TEXT`; `realizada_en DATETIME(6)`; `registrada_en DATETIME(6)`; `id_responsable FK usuarios?`; `fecha_limite DATE?`; `id_actuacion_corregida FK actuaciones?` |
| 19 | `historial_cambios`: bitácora inmutable de operaciones relevantes | `id`; `id_incidencia FK incidencias?`; `id_actor FK usuarios`; `id_rol_actor FK roles`; `ocurrido_en DATETIME(6)`; `accion VARCHAR(60)`; `entidad VARCHAR(60)`; `id_registro BIGINT UNSIGNED`; `campo VARCHAR(60)?`; `valor_anterior TEXT?`; `valor_nuevo TEXT?`; `motivo TEXT?` |
| 20 | `solicitudes_cambio`: peticiones justificadas de rectificación o anulación | `id`; `id_incidencia FK incidencias`; `id_solicitante FK usuarios`; `id_rol_solicitante FK roles`; `tipo VARCHAR(20)`; `justificacion TEXT`; `creada_en DATETIME(6)`; `estado VARCHAR(20)`; `id_version_base BIGINT UNSIGNED`; `id_version_propuesta BIGINT UNSIGNED? UQ`; `confidencialidad_propuesta VARCHAR(20)?`; `requiere_revision_formal BOOLEAN`; `motivo_revision VARCHAR(500)?`; UQ `(id_incidencia, id)` |

Las actuaciones se agregan, no se sobrescriben; una corrección enlaza la actuación anterior de la misma incidencia y explica el motivo. No se usa esta vía para alterar los hechos confirmados. El responsable y plazo son opcionales; el cumplimiento se describe mediante nuevas actuaciones, sin introducir aún un subsistema de tareas.

La bitácora registra confirmación, estados, prioridad, acceso sensible, permisos, solicitudes y decisiones. Una operación sobre varios campos puede producir varias filas dentro de la misma transacción. Los hechos completos anteriores se conservan en versiones; no se duplican enteros en la bitácora. `entidad` e `id_registro` identifican el objeto auditado de distintas tablas y no constituyen una FK polimórfica: la aplicación valida el destino. Es una excepción limitada a auditoría, no sustituye relaciones funcionales. No se guardan contraseñas, hashes de contraseñas ni tokens en valores auditados.

Tipos de solicitud: `rectificacion` y `anulacion`. Estados: `pendiente`, `aprobada`, `rechazada`, `retirada`, `obsoleta`. Toda rectificación de hechos confirmados usa una nueva versión completa con sus estudiantes; una rectificación solo de confidencialidad puede no crear versión. La anulación no crea una versión de hechos ni elimina datos.

### Revisión e independencia (21–25)

| N.º | Tabla y finalidad | Columnas principales |
| --- | --- | --- |
| 21 | `revisiones_formales`: proceso formal cuando la situación lo requiere | `id`; `id_incidencia FK incidencias`; `id_solicitud BIGINT UNSIGNED?`; `id_convocante FK usuarios`; `motivo TEXT`; `abierta_en DATETIME(6)`; `cerrada_en DATETIME(6)?`; `estado VARCHAR(20)` (`abierta`, `concluida`); `requiere_acta BOOLEAN`; `fundamento_acta VARCHAR(500)`; `conclusion TEXT?`; UQ `(id_incidencia, id)` |
| 22 | `participantes_revision`: personas convocadas y su intervención | `id_revision FK revisiones_formales`; `id_persona FK personas`; `funcion VARCHAR(60)`; `asistio BOOLEAN`; `intervencion TEXT?`; PK compuesta `(id_revision, id_persona)` |
| 23 | `decisiones_solicitud`: resolución independiente de una solicitud | `id`; `id_solicitud FK solicitudes_cambio UQ`; `id_incidencia FK incidencias`; `id_revision BIGINT UNSIGNED?`; `id_decisor FK usuarios`; `id_rol_decisor FK roles`; `resultado VARCHAR(20)` (`aprobada`, `rechazada`); `fundamento TEXT`; `decidida_en DATETIME(6)` |
| 24 | `actas_revision`: acta opcional y sus sustituciones documentales | `id`; `id_revision FK revisiones_formales`; `numero_version INT UNSIGNED`; `contenido TEXT`; `id_autor FK usuarios`; `emitida_en DATETIME(6)`; `id_acta_anterior FK actas_revision? UQ`; UQ `(id_revision, numero_version)` |
| 25 | `conflictos_interes`: declaración de conflicto e inhibición por incidencia | `id`; `id_incidencia FK incidencias`; `id_usuario_afectado FK usuarios`; `id_declarante FK usuarios`; `motivo TEXT`; `declarado_en DATETIME(6)`; `estado VARCHAR(20)` (`pendiente`, `inhibido`, `descartado`); `id_resolutor FK usuarios?`; `resuelto_en DATETIME(6)?`; `fundamento_resolucion TEXT?` |

La revisión formal puede estudiar la incidencia directamente o una solicitud concreta; una solicitud puede tener varias revisiones, pero solo una decisión final. Ser participante no otorga facultad de decidir. La conclusión de una revisión recoge acuerdos; la aprobación efectiva de una solicitud queda en decisiones_solicitud. Las decisiones no se editan; una petición rechazada puede motivar una nueva solicitud.

El acta es texto conservado en la base, no un PDF generado en esta fase. Cada versión emitida es inmutable, y una corrección referencia la anterior dentro de la misma revisión. No se exige reunión, revisión ni acta en todas las incidencias.

Un conflicto pendiente bloquea preventivamente la decisión del afectado. `inhibido` confirma su apartamiento; `descartado` exige fundamento de un resolutor independiente. El usuario afectado no puede resolver su propio conflicto. Los conflictos se aplican a todas las solicitudes y revisiones de la incidencia, y no se eluden reasignando el rol del usuario.

## 3. Relaciones y cardinalidades

- personas 1–0..1 usuarios y 1–0..1 estudiantes; estudiantes N–M personas apoderadas mediante estudiantes_apoderados.
- roles 1–N usuarios; roles N–M permisos mediante roles_permisos; usuarios N–M permisos mediante usuarios_permisos.
- estudiantes 1–N matriculas; aulas 1–N matriculas. Se conserva la secuencia de traslados por fechas.
- categorias_incidencia 1–N tipos_incidencia; tipos_incidencia 1–N versiones_incidencia.
- usuarios 1–N incidencias como registradores; estados y prioridades 1–N incidencias.
- incidencias 1–N versiones_incidencia; cada incidencia confirmada apunta a exactamente una versión vigente. Una versión referencia una persona reportante y 0..N estudiantes mediante versiones_estudiantes.
- incidencias 1–N actuaciones, historial_cambios, solicitudes_cambio, revisiones_formales y conflictos_interes.
- solicitudes_cambio referencia una versión base y, opcionalmente, una versión propuesta; tiene 0..1 decisión y 0..N revisiones.
- revisiones_formales N–M personas mediante participantes_revision y 1–0..N actas_revision. Una decisión puede referenciar una revisión concluida de la misma solicitud.

Las FK compuestas `(id_incidencia, id_version_vigente)`, `(id_incidencia, id_version_base)` y `(id_incidencia, id_version_propuesta)` apuntarán a `(id_incidencia, id)` de versiones_incidencia. Así ninguna referencia puede cruzarse a otra incidencia. La versión vigente será NULL solo durante la creación transaccional o mientras aún no haya contenido de borrador.

Aplicar el mismo patrón compuesto a revisión–solicitud y decisión–solicitud/revisión para impedir cruces entre incidencias. La aplicación comprueba además que la revisión citada por una decisión corresponde a esa solicitud concreta, no solo a la misma incidencia. Las referencias de correcciones de actuaciones y actas deben permanecer en su incidencia/revisión y apuntar a una fila anterior, sin ciclos.

## 4. Integridad, seguridad e índices

### Garantías declarativas previstas

- PK, FK, UQ y campos obligatorios según las tablas. `ON DELETE RESTRICT` para relaciones históricas. Identificadores inmutables; cuentas y catálogos se desactivan.
- Restricciones de dominio para estados, tipos, niveles y valores booleanos; números de versión positivos, mínimos de estudiantes no negativos y fechas finales iguales o posteriores a iniciales.
- En solicitudes: anulación sin versión ni confidencialidad propuestas; rectificación con al menos una de ambas. Decisiones con resultado aprobado o rechazado. El estado final de solicitud debe coincidir con la decisión.
- No emplear JSON para estudiantes, participantes, permisos, cambios propuestos ni versiones. No se necesitan triggers ni procedimientos almacenados para esta propuesta.

### Reglas entre filas y autorización en el servidor

Las FK y restricciones de una fila no bastan para controlar permisos, inmutabilidad o independencia. Implementar estas reglas mediante validación y transacciones en el servidor; la cuenta SQL de la aplicación no tendrá DELETE sobre registros históricos ni DDL. RESTRICT por sí solo no protege una fila que no tenga dependientes.

- No eliminar físicamente incidencias confirmadas, versiones presentadas, decisiones, actuaciones, actas ni historial. Los borradores también se conservan por simplicidad; decidir después una política de descarte.
- Estados de versión: `borrador`, `propuesta`, `confirmada`. Solo el borrador es editable. Al presentar una solicitud, congelar la versión propuesta y sus estudiantes; al aprobar, cambiar solo su estado a confirmada y el puntero vigente. Las propuestas rechazadas permanecen disponibles como evidencia.
- Las versiones confirmadas anteriores siguen confirmadas: cuál está vigente se obtiene del puntero de la incidencia, sin duplicar una bandera `vigente` por versión.
- Exigir reportante, contenido válido y mínimo de estudiantes solo al confirmar/presentar; durante edición usar un borrador con valores aún incompletos únicamente en memoria del formulario. El borrador persistido debe cumplir los campos obligatorios de esta propuesta. Revisar esta decisión antes de implementar autoguardado.
- Como propuesta conservadora, Director o Subdirector resuelven solicitudes; nunca el solicitante ni alguien con conflicto pendiente o inhibición. Comparar identidad de persona además del usuario, y aplicar las restricciones aunque cambie su rol. Las demás facultades deben concretarse en la matriz institucional.
- No basta con no ser solicitante: detectar si el decisor es reportante, persona involucrada, apoderado vinculado u otro caso que genere conflicto. La detección automática se complementa con declaración y revisión humana. Si ambas autoridades están impedidas, bloquear y escalar según un procedimiento aún por acordar, sin otorgar aprobación al Administrador.
- No permitir una decisión si falta revisión formal obligatoria, si sigue abierta o si no existe acta cuando es requerida. Un acta y la asistencia de participantes no sustituyen la aprobación independiente.
- Bloquear la fila de incidencia durante confirmación, presentación y resolución. Verificar que la versión base sigue vigente. Serializar solicitudes pendientes por incidencia (máximo una) y números de versión mediante la misma transacción; no confiar solo en una validación previa desde el formulario.
- Al resolver, actualizar versión vigente o estado anulado, insertar decisión, cerrar solicitud y registrar auditoría en una sola transacción. Si cambia la versión base por otra operación, marcar la solicitud obsoleta y solicitar una nueva evaluación; no aplicar silenciosamente cambios sobre otros hechos.
- Validar matrículas no superpuestas para un estudiante y apoderados principales no superpuestos por periodo; estas reglas temporales requieren transacción, no solo UQ. Conservar las matrículas usadas como contexto histórico.
- En registros y decisiones, tomar usuario, rol e instante de la sesión y del servidor, nunca de campos editables del cliente.
- Restringir consultas por autorización, nivel de confidencialidad y conflicto, incluso para reportes y auditoría. El Administrador no recibe acceso al contenido confidencial por administrar cuentas. Los catálogos y permisos no conceden acceso implícito a todos los expedientes.
- Reducir datos personales al mínimo, usar hash seguro para contraseñas, proteger sesiones/cookies httpOnly en la futura autenticación, cifrar transporte y respaldos y limitar acceso a la cuenta MySQL. El modelo relacional por sí solo no garantiza confidencialidad.

Índices propuestos: todas las FK; `incidencias(id_estado, id_prioridad, registrada_en)`; `incidencias(id_registrador, registrada_en)`; `versiones_estudiantes(id_estudiante, id_version)`; `actuaciones(id_incidencia, registrada_en)`; `solicitudes_cambio(id_incidencia, estado)`; `historial_cambios(id_incidencia, ocurrido_en)` y `(entidad, id_registro, ocurrido_en)`; `conflictos_interes(id_incidencia, id_usuario_afectado, estado)`. Reutilizar índices PK/UQ existentes y ajustar los adicionales a consultas reales, sin indexar todos los textos.

## 5. Flujos propuestos

### Registro y seguimiento

1. Un usuario autorizado inicia una incidencia borrador; el servidor identifica registrador, rol, nombre histórico e instante. Selecciona por separado la persona reportante y su condición.
2. Guarda contenido y 0..N estudiantes según el caso. Corrige el borrador antes de confirmar; no se guarda una versión por cada pulsación.
3. Al confirmar, valida identidad, contenido, mínimo de estudiantes y autorización. Congela versión y participantes, fija confirmada_en y cambia el estado a confirmada dentro de una transacción auditada.
4. Agrega actuaciones y observaciones autorizadas. Puede pasar a en_seguimiento y cerrada sin alterar hechos; la reapertura requiere permiso y motivo auditado. Una incidencia anulada no admite seguimiento ordinario ni reapertura automática.

### Rectificación

1. Un usuario autorizado presenta justificación y una copia completa corregida de la versión vigente, incluidos estudiantes, o el nuevo nivel de confidencialidad. Se registra la versión base; la propuesta queda congelada y aún no reemplaza los hechos.
2. Se evalúan conflictos y necesidad de revisión formal. Cuando corresponde, se registran participantes, conclusión y acta. El solicitante puede explicar su petición pero no resolverla.
3. Una autoridad independiente aprueba o rechaza con fundamento. Si aprueba, la transacción activa la nueva versión y/o el nivel de confidencialidad; conserva la anterior y toda evidencia. Si rechaza o se retira, los hechos vigentes no cambian.

### Anulación

1. Se presenta solicitud de anulación justificada de una incidencia confirmada, en seguimiento o cerrada.
2. Se aplican los mismos controles de independencia, conflictos y revisión cuando proceda.
3. Al aprobar, se cambia el estado a anulada y se registra decisión e historial. Permanecen identidad, versiones, reportante, estudiantes, actuaciones y actas. La fecha y el responsable de anulación se consultan desde la decisión, sin duplicarlos en incidencias. No hay eliminación física ni restauración automática.

## 6. Decisiones pendientes de revisión

1. Validar un solo rol vigente por usuario y si se necesitan excepciones individuales de permisos; si no se necesitan, eliminar usuarios_permisos antes de crear el esquema. Acordar quién autoriza asignaciones sensibles, suplencias y cambios de rol.
2. Aprobar la matriz de acceso, especialmente confidencialidad, actuaciones, cierre/reapertura y clasificación. Precisar si otras autoridades podrán resolver peticiones y cómo escalar cuando Director y Subdirector estén impedidos.
3. Definir qué cambios exigen revisión formal, quién la declara, composición, quórum, recusaciones, actas y firmas. Esta propuesta conserva un decisor responsable; una votación colegiada individual requeriría modelado adicional, no texto libre como sustituto.
4. Validar tipos de incidencias, mínimos de estudiantes, participaciones, prioridades y gravedad disciplinaria. Los campos específicos por categoría se diseñarán cuando existan formularios acordados, mediante relaciones explícitas; no un almacén genérico JSON ni una tabla de atributos sin criterio.
5. Confirmar un reportante por incidencia, tratamiento de reportes anónimos y estudiantes de otras instituciones. Actualmente se exige una persona reportante identificable internamente; no fabricar personas para representar anonimato.
6. Acordar documentos admitidos, códigos internos y verificación de identidades extranjeras o provisionales. Validar niveles, grados, traslados y reglas para apoderados principales.
7. Confirmar si se necesita autoguardado de borradores incompletos; la propuesta actual persiste borradores con campos obligatorios completos y no implementa descarte físico.
8. Definir conservación, acceso y corrección de datos personales maestros; no sobrescribir identidades para hacerlas pasar por otra persona. La bitácora conserva cambios de maestros y los nombres históricos fijan quién registró/reportó. Revisar si actas requieren más identidad histórica, firmas o anexos.
9. Acordar retención y protección de auditoría y respaldos, evidencias adjuntas y límites de texto. No se incorporan archivos, sesiones persistidas ni informes PDF al modelo de esta fase.

La propuesta está lista para revisión de diseño. La implementación SQL y su validación contra MySQL 8 corresponden a una tarea posterior autorizada.
