# SICE-Local: revisión integral del modelo relacional

Fase 2.1 · 30 de octubre de 2026 · **Propuesta para revisión humana; no aprobada**.

Institución: I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete.

## 1. Resultado y alcance

Se propone un único modelo de **19 tablas**. Resuelve desde ahora identidad de personas, aulas, apoderados múltiples, reportantes externos, participantes y conservación de hechos, sin forzar un número arbitrario. No introduce catálogos para categorías, estados o prioridades fijas ni una tabla por formulario.

Respecto de las 16 tablas anteriores: se añaden personas, estudiantes_apoderados, aulas y participantes_revision; se elimina la tabla independiente apoderados, cuya identidad pasa a personas y cuyo vínculo pasa a estudiantes_apoderados. Las otras 15 se conservan, con las simplificaciones descritas abajo. La decisión permanece en solicitudes_cambio y el acta en revisiones.

Los 15 casos tienen representación relacional. En el caso 13 se representa el bloqueo por impedimento de ambas autoridades, pero **el procedimiento para resolverlo sigue pendiente de aprobación institucional**. Permisos, confidencialidad, formularios y criterios de revisión requieren validación del colegio; una estructura suficiente no equivale a aprobación funcional ni a seguridad implementada.

No se genera SQL, migraciones, datos demo ni código. No se implementa autoguardado de borradores. La validación es conceptual, no una prueba ejecutada sobre MySQL.

## 2. Convenciones

- MySQL 8, InnoDB y utf8mb4; nombres descriptivos en español, snake_case y sin tildes.
- `id`: PK `BIGINT UNSIGNED` autoincremental, salvo PK compuesta indicada. Toda FK usa el tipo de su destino. `UQ`: unicidad; `?`: NULL permitido; resto obligatorio. Las FK apuntan a id salvo indicación explícita.
- `DATE` para fechas civiles, `DATETIME(6)` UTC para instantes, presentación en America/Lima. Servidor genera registro/decisión; fecha de ocurrencia es declarada y puede desconocerse.
- Documentos y teléfonos son texto. `BOOLEAN` limitado a 0/1. Códigos `VARCHAR` restringidos a dominios cerrados, no textos arbitrarios.
- Las relaciones usan FK; nunca JSON, listas de IDs ni texto separado por comas. Narrativas de hechos, motivos y actas sí son texto: no sustituyen personas, participantes o relaciones familiares.
- Identidad y catálogos se consultan por relaciones. Solo se duplican nombres o datos expresamente históricos para conservar cómo se identificaron los actores al registrar un documento.
- Se propone conservar también borradores guardados explícitamente. No existe borrado físico de registros confirmados ni de sus evidencias.

## 3. Lista final propuesta y columnas principales

### Identidad y autorización (1–5)

| N.º | Tabla: finalidad en una frase | Columnas principales |
| --- | --- | --- |
| 1 | `personas`: identifica una sola vez a personal, estudiantes, apoderados y externos. | `id`; `codigo_interno VARCHAR(30) UQ`; `nombres VARCHAR(100)`; `apellidos VARCHAR(150)`; `tipo_documento VARCHAR(20)?`; `numero_documento VARCHAR(40)?`; `pais_documento CHAR(2)?`; `es_personal BOOLEAN`; `telefono VARCHAR(30)?`; `correo VARCHAR(254)?`; `activo BOOLEAN` |
| 2 | `roles`: identifica los seis perfiles con los que se conceden permisos y se registra autoría. | `id`; `codigo VARCHAR(30) UQ`; `nombre VARCHAR(60) UQ` |
| 3 | `usuarios`: permite acceso autenticado a una persona del personal con un rol vigente. | `id`; `id_persona FK personas UQ`; `id_rol FK roles`; `nombre_usuario VARCHAR(60) UQ`; `contrasena_hash VARCHAR(255)`; `activo BOOLEAN`; `creado_en DATETIME(6)` |
| 4 | `permisos`: identifica las acciones que pueden concederse a los roles. | `id`; `codigo VARCHAR(80) UQ`; `descripcion VARCHAR(255)` |
| 5 | `roles_permisos`: relaciona cada rol con sus acciones concedidas. | `id_rol FK roles`; `id_permiso FK permisos`; PK `(id_rol, id_permiso)` |

Roles: Director, Subdirector, Coordinador de Tutoría, Docente, Auxiliar y Administrador. Director y Subdirector son máximas autoridades; la jerarquía no depende del valor de la PK. Un rol vigente por usuario, sin excepciones individuales de permisos. El rol ejercido en un acto se conserva donde corresponda, no se deduce del rol actual.

Una persona puede ser docente y apoderada simultáneamente. Personal sin cuenta y externos pueden reportar o asistir a una revisión mediante personas sin crear cuentas ficticias. `es_personal` describe pertenencia actual; la condición histórica del reportante se conserva en la versión. Desactivar una cuenta no elimina su identidad ni autoría.

Los tres campos documentales se completan juntos o quedan juntos en NULL; UQ `(pais_documento, tipo_documento, numero_documento)` cuando existen. Normalizar su formato. Admitir DNI, carné de extranjería, pasaporte u otro documento autorizado. Si no se dispone de documento, el código interno identifica a la persona provisionalmente, con verificación humana; no inventar DNI. La unicidad no detecta por sí sola duplicados sin documento: conciliarlos antes de crear cuentas y sin fusionar automáticamente identidades históricas.

### Organización escolar (6–9)

| N.º | Tabla: finalidad en una frase | Columnas principales |
| --- | --- | --- |
| 6 | `estudiantes`: registra la condición y datos escolares de una persona estudiante. | `id_persona FK personas`, también PK; `codigo_estudiante VARCHAR(30) UQ`; `fecha_nacimiento DATE?`; `activo BOOLEAN` |
| 7 | `estudiantes_apoderados`: conserva quién representa a cada estudiante y durante qué periodo. | `id`; `id_estudiante FK estudiantes(id_persona)`; `id_apoderado FK personas`; `vinculo VARCHAR(30)`; `es_principal BOOLEAN`; `vigente_desde DATE`; `vigente_hasta DATE?`; UQ `(id_estudiante, id_apoderado, vigente_desde)` |
| 8 | `aulas`: identifica grupos escolares válidos por año lectivo. | `id`; `anio_lectivo SMALLINT UNSIGNED`; `nivel VARCHAR(20)`; `grado TINYINT UNSIGNED`; `seccion VARCHAR(20)`; `activo BOOLEAN`; UQ `(anio_lectivo, nivel, grado, seccion)` |
| 9 | `matriculas`: conserva la pertenencia de un estudiante a un aula durante un intervalo. | `id`; `id_estudiante FK estudiantes(id_persona)`; `id_aula FK aulas`; `fecha_inicio DATE`; `fecha_fin DATE?`; UQ `(id_estudiante, fecha_inicio)` y `(id_estudiante, id)` |

El colegio atiende estudiantes varones; validar esta condición de admisión sin añadir una columna con valor constante ni imponerla a personal o apoderados. Una persona es apoderada por su relación con un estudiante, no por una tabla que repita nombres/documentos. Admitir varios apoderados por estudiante y varios estudiantes por apoderado. Los intervalos de representación y matrícula son independientes.

Aulas evita repetir y contradecir año/nivel/grado/sección en cada matrícula. No se añaden cupos, tutores ni infraestructura no solicitada. Los grupos históricos usados no se reutilizan para otro año ni cambian de significado. Traslados generan otra matrícula, conservando la anterior.

### Hechos y seguimiento (10–14)

| N.º | Tabla: finalidad en una frase | Columnas principales |
| --- | --- | --- |
| 10 | `tipos_incidencia`: clasifica el hecho dentro de una de las seis categorías. | `id`; `categoria VARCHAR(30)`; `nombre VARCHAR(100)`; `minimo_estudiantes SMALLINT UNSIGNED`; `activo BOOLEAN`; UQ `(categoria, nombre)` |
| 11 | `incidencias`: mantiene la identidad del expediente, su registrador y estado operativo. | `id`; `id_registrador FK usuarios`; `id_rol_registrador FK roles`; `nombre_registrador VARCHAR(251)` histórico; `registrada_en DATETIME(6)`; `confirmada_en DATETIME(6)?`; `estado VARCHAR(20)`; `prioridad VARCHAR(10)`; `confidencialidad VARCHAR(20)`; `id_version_vigente BIGINT UNSIGNED?` |
| 12 | `versiones_incidencia`: conserva cada borrador, propuesta o versión confirmada de los hechos. | `id`; `id_incidencia FK incidencias`; `numero_version INT UNSIGNED`; `estado_version VARCHAR(20)`; `id_autor FK usuarios`; `creada_en DATETIME(6)`; `id_tipo FK tipos_incidencia`; `titulo VARCHAR(200)`; `descripcion TEXT`; `ocurrida_en DATETIME(6)?`; `lugar VARCHAR(255)?`; `id_reportante FK personas`; `condicion_reportante VARCHAR(20)`; `nombre_reportante VARCHAR(251)` histórico; `gravedad_disciplinaria VARCHAR(20)?`; campos de categoría de la sección 5; UQ `(id_incidencia, numero_version)` y `(id_incidencia, id)` |
| 13 | `involucrados`: relaciona los estudiantes con la versión que describe su participación. | `id_version FK versiones_incidencia`; `id_estudiante FK estudiantes(id_persona)`; `id_matricula BIGINT UNSIGNED?`; `participacion VARCHAR(30)`; PK `(id_version, id_estudiante)` |
| 14 | `actuaciones`: agrega acciones u observaciones sin reescribir los hechos confirmados. | `id`; `id_incidencia FK incidencias`; `id_autor FK usuarios`; `id_rol_autor FK roles`; `tipo VARCHAR(20)`; `detalle TEXT`; `realizada_en DATETIME(6)`; `registrada_en DATETIME(6)`; `id_responsable FK usuarios?`; `fecha_limite DATE?`; `id_actuacion_corregida FK actuaciones?`; UQ `(id_incidencia, id)` |

El registrador se toma de la sesión; nombre, rol e instante son fijados por el servidor. El reportante se selecciona separadamente y puede coincidir o no con él. `condicion_reportante`: personal, estudiante, apoderado o externo, indicando cómo reportó en ese momento. Validar contra personas/estudiantes/estudiantes_apoderados según proceda; conservar la condición aunque después cambie. Un reportante externo usa la misma FK personas y puede reaparecer sin duplicar identidad.

La incidencia tiene cero, uno o varios estudiantes; verificar al confirmar el mínimo del tipo, que puede ser cero. No hay mínimo global de dos. `involucrados` pertenece a la versión para conservar el conjunto anterior tras una rectificación. Se propone una participación principal por estudiante: afectado, testigo o involucrado; no presume culpabilidad. La matrícula es opcional si se desconoce el contexto, pero debe pertenecer al mismo estudiante y al periodo del hecho cuando la fecha sea conocida.

Estados de incidencia: borrador, confirmada, en_seguimiento, cerrada, anulada. Prioridades: baja, normal, alta, urgente. Gravedad disciplinaria: NULL si no aplica; por_evaluar, leve, grave o muy_grave como vocabulario propuesto. Urgencia de atención no implica gravedad disciplinaria. Tipos de actuación: actuacion, observacion. Son dominios cerrados, sujetos a validación institucional donde se indica.

### Cambios, revisión y auditoría (15–19)

| N.º | Tabla: finalidad en una frase | Columnas principales |
| --- | --- | --- |
| 15 | `solicitudes_cambio`: conserva una petición justificada y su única resolución final. | `id`; `id_incidencia FK incidencias`; `id_solicitante FK usuarios`; `id_rol_solicitante FK roles`; `tipo VARCHAR(20)`; `justificacion TEXT`; `creada_en DATETIME(6)`; `estado VARCHAR(20)`; `id_version_base BIGINT UNSIGNED`; `id_version_propuesta BIGINT UNSIGNED? UQ`; `confidencialidad_propuesta VARCHAR(20)?`; `motivo_anulacion VARCHAR(20)?`; `id_incidencia_duplicada FK incidencias?`; `requiere_revision BOOLEAN`; `fundamento_revision VARCHAR(500)`; `id_revision_resolutiva BIGINT UNSIGNED?`; `id_decisor FK usuarios?`; `id_rol_decisor FK roles?`; `fundamento_decision TEXT?`; `decidida_en DATETIME(6)?`; UQ `(id_incidencia, id)` |
| 16 | `revisiones`: documenta una evaluación formal, su eventual reunión y su acta cuando corresponda. | `id`; `id_incidencia FK incidencias`; `id_solicitud BIGINT UNSIGNED?`; `id_responsable FK usuarios`; `motivo TEXT`; `abierta_en DATETIME(6)`; `cerrada_en DATETIME(6)?`; `estado VARCHAR(20)`; `hubo_reunion BOOLEAN`; `reunion_en DATETIME(6)?`; `requiere_acta BOOLEAN`; `fundamento_acta VARCHAR(500)`; `acta TEXT?`; `id_emisor_acta FK usuarios?`; `acta_emitida_en DATETIME(6)?`; `conclusion TEXT?`; `id_revision_anterior FK revisiones? UQ`; UQ `(id_incidencia, id)` |
| 17 | `participantes_revision`: identifica a cada persona convocada y su intervención en una revisión. | `id_revision FK revisiones`; `id_persona FK personas`; `funcion VARCHAR(40)`; `asistencia VARCHAR(15)`; `intervencion TEXT?`; `nombre_participante VARCHAR(251)` histórico; PK `(id_revision, id_persona)` |
| 18 | `historial`: registra de forma inmutable quién realizó cada operación relevante y cuándo. | `id`; `id_actor FK usuarios`; `id_rol_actor FK roles`; `ocurrido_en DATETIME(6)`; `accion VARCHAR(60)`; `id_incidencia FK incidencias?`; referencias de destino indicadas debajo; `campo VARCHAR(60)?`; `valor_anterior TEXT?`; `valor_nuevo TEXT?`; `motivo TEXT?` |
| 19 | `conflictos_interes`: registra declaraciones de conflicto, inhibiciones y su resolución independiente. | `id`; `id_incidencia FK incidencias`; `id_usuario_afectado FK usuarios`; `id_declarante FK usuarios`; `motivo TEXT`; `declarado_en DATETIME(6)`; `estado VARCHAR(20)`; `id_resolutor FK usuarios?`; `resuelto_en DATETIME(6)?`; `fundamento_resolucion TEXT?`; UQ `(id_incidencia, id)` |

**Solicitud y decisión.** Tipos: rectificacion, anulacion. Estados: pendiente, aprobada, rechazada, retirada, obsoleta. Decisor, rol, fundamento y fecha son obligatorios juntos en aprobada/rechazada y NULL en los otros estados. La decisión se escribe una vez; una reconsideración usa otra solicitud. Motivos de anulación propuestos: duplicado u otro, siempre con justificación. Si es duplicado, la FK id_incidencia_duplicada identifica el expediente que permanece; debe ser distinto y válido. No se elimina ni fusiona automáticamente ningún expediente.

**Revisión y acta.** Estados: abierta, concluida. Cada fila es una evaluación formal, con como máximo una reunión y un acta; varias reuniones se representan mediante varias revisiones del mismo expediente/solicitud. No toda incidencia requiere revisión, no toda revisión reunión ni toda reunión acta. Participantes se relacionan por persona, incluido personal sin cuenta y externos; funciones no conceden permisos. Asistencia: pendiente, asistio, ausente; al cerrar una reunión no queda asistencia pendiente. La conclusión no equivale a una aprobación: esta reside en la solicitud.

Al concluir se congelan revisión, participantes y acta. Un acta emitida antes del cierre congela también su contenido y participantes asociados. Una subsanación crea revisión complementaria enlazada a la anterior y conserva ambas, sin reescribir una decisión previa. No se agregan ediciones múltiples del mismo documento ni firmas digitales no solicitadas; esta forma de subsanación documental requiere aceptación institucional.

**Historial con destinos reales.** Añadir FK opcionales `id_persona`, `id_usuario_afectado`, `id_rol_afectado`, `id_permiso`, `id_vinculo_apoderado` a estudiantes_apoderados, `id_aula`, `id_matricula`, `id_tipo_incidencia`, `id_version`, `id_estudiante` a estudiantes(id_persona), `id_actuacion`, `id_solicitud`, `id_revision` e `id_conflicto` a sus tablas respectivas. Para cambios de rol de cuenta, `id_rol_anterior` e `id_rol_nuevo` son FK opcionales a roles. Las referencias de contexto pueden coexistir (por ejemplo revisión/persona para un participante, versión/estudiante para un involucrado, rol/permiso para una concesión). Cada accion establece qué referencias exige y el backend verifica que pertenezcan al mismo expediente cuando proceda.

Las relaciones operativas siempre viven en sus tablas; el historial no es la fuente de permisos o participantes. Las referencias de auditoría apuntan a sus extremos para conservar evidencia incluso al revocar un permiso o corregir relaciones de un borrador. `valor_anterior/nuevo` conserva valores escalares o narrativos, nunca listas ni relaciones ocultas. Cada campo cambiado puede generar una fila en la misma transacción. Los cambios de vínculos guardan sus extremos mediante FK; no solo IDs escritos como texto. No registrar contraseñas, hashes de contraseña ni tokens.

**Conflictos.** Estados: pendiente, inhibido, descartado. Pendiente e inhibido bloquean decisiones del afectado. La declaración propia puede quedar inhibida de inmediato; eso no resuelve favorablemente ninguna petición. Descartar un conflicto exige otro resolutor autorizado, fecha y fundamento. El afectado no resuelve su propio conflicto. Se conserva la declaración aunque después se descarte, y se audita la transición.

## 4. Revisión de cada tabla anterior y necesidad de las incorporaciones

Esta matriz revisa las 16 tablas anteriores: las columnas y claves finales están en la sección 3; las reglas backend se agrupan en la sección 7.

| Tabla anterior | Función necesaria, duplicación y simplificación | Control backend principal |
| --- | --- | --- |
| roles | Se conserva: permisos por rol y autoría histórica necesitan una identidad referenciable, aunque haya seis valores. No duplicar jerarquía en números. | R1: seis perfiles, rol vigente y límites no delegables. |
| usuarios | Se conserva solo como cuenta; nombres/documentos pasan a personas. UQ id_persona impide dos cuentas de la misma identidad registrada. | R1: personal autorizado, identidad verificada, cambio de rol auditado. |
| permisos | Se conserva: acciones configurables, no columnas booleanas por funcionalidad. | R1: catálogo técnico permitido y facultades de asignación. |
| roles_permisos | Se conserva: N–M imprescindible para configurar permisos sin listas. | R1/R7: no conceder facultades prohibidas; auditar altas/bajas. |
| estudiantes | Se conserva como perfil escolar; no repite identidad ni sexo constante. | R2: admisión y código único, identidad extranjera/provisional. |
| apoderados | Se elimina como entidad duplicada; identidad en personas y representación en estudiantes_apoderados. | R2/R6: vigencia del vínculo y parentesco relevante para conflictos. |
| matriculas | Se conserva; sustituye año/nivel/grado/sección repetidos por FK aulas. | R2: periodos, traslados y aula del año correcto. |
| tipos_incidencia | Se conserva para tipos configurables; categoría fija como dominio, no catálogo separado. | R3: mínimo de estudiantes y tipo sin reinterpretación histórica. |
| incidencias | Se conserva: identidad y estado operativo separados de hechos versionados. Nombre/rol iniciales son copias históricas justificadas. | R3/R7: sesión, transiciones, prioridad y confidencialidad. |
| versiones_incidencia | Se conserva: evita perder contenido anterior; sustituye tres FK alternativas del reportante por una FK personas. | R3/R4: inmutabilidad, formulario pertinente y versión base vigente. |
| involucrados | Se conserva: N–M estudiantes/versiones; no duplicar estudiantes dentro de una narrativa. | R3: cero o varios, matrícula propia, conjunto congelado. |
| actuaciones | Se conserva: seguimiento no es una nueva versión de los hechos. | R5: adición autorizada, corrección enlazada, sin sobrescritura. |
| solicitudes_cambio | Se conserva con decisión integrada; una tabla separada repetiría una relación 1–0..1 sin necesidad actual. | R4/R6: justificación, independencia, atomicidad, anulación lógica. |
| revisiones | Se conserva con acta opcional integrada; responsable no sustituye participantes. | R6: revisión/reunión/acta según criterios y cierre inmutable. |
| historial | Se conserva: versiones no registran cambios de permisos, estados o accesos. No copia expedientes completos. | R7: destino coherente, append-only, datos mínimos y acceso protegido. |
| conflictos_interes | Se conserva: impedimento por expediente no equivale a desactivar un usuario globalmente. | R6: bloqueo, resolución independiente y ausencia de autoaprobación. |

Justificación concreta de las cuatro incorporaciones:

- **personas:** una docente también es madre y reportante; un externo puede reportar y participar sin cuenta. Las identidades separadas obligaban a duplicar documentos y comparar varias FK. Una identidad común resuelve ambos casos y permite comprobar independencia por persona.
- **estudiantes_apoderados:** Luis tiene dos responsables y su madre representa también a Pedro. Ninguna FK única en estudiantes o personas representa ese N–M con vigencia; duplicar a la madre rompe la normalización.
- **aulas:** treinta matrículas del mismo grupo deben referenciar el mismo año/grado/sección válido. Sin esa entidad, «A» y «AA» podrían crear grupos aparentes y corregir un nombre exigiría modificar muchas matrículas. Aulas ya forma parte del contexto escolar conocido.
- **participantes_revision:** Subdirector, docente, estudiante y madre asisten a una misma revisión; el responsable único o los nombres dentro del acta no permiten comprobar asistencia, identidad ni conflicto. Es un N–M independiente de involucrados, que describe estudiantes en hechos, no personas en reuniones.

No se añaden tablas para estados, prioridades, categorías fijas, sexo constante, decisiones 1–0..1, actas únicas por revisión, excepciones de permisos individuales, sesiones, inventario ni firma digital. Permisos y roles sí conservan tablas porque tienen relaciones configurables e historia referenciable.

## 5. Datos de las seis categorías

Categorías de tipos_incidencia: convivencia, disciplina, salud, seguridad, bienes, proteccion_estudiantil. Se derivan por id_tipo; no se duplican en la versión. Un tipo usado no cambia de categoría ni significado: se desactiva y se crea otro si es necesario.

Además de título, descripción, ocurrencia, lugar y reportante comunes, versiones_incidencia contiene estas columnas anulables:

| Categoría | Campos pertinentes propuestos | Alcance y control |
| --- | --- | --- |
| Convivencia | `ambito_convivencia VARCHAR(20)?`; `requiere_mediacion BOOLEAN?` | Ámbito presencial/digital/mixto; participantes estudiantiles en involucrados, sin presunción de culpabilidad. |
| Disciplina | `norma_referida VARCHAR(100)?`; `gravedad_disciplinaria VARCHAR(20)?` | Referencia normativa histórica; no inventa catálogo de sanciones. Gravedad independiente de prioridad. |
| Salud | `sintomas_observados TEXT?`; `requiere_atencion_inmediata BOOLEAN?` | Observaciones, no diagnósticos obligatorios ni historia clínica. Atención posterior en actuaciones. |
| Seguridad | `riesgo_identificado TEXT?`; `riesgo_persistente BOOLEAN?` | Un hecho puede referirse a una instalación sin estudiantes. |
| Bienes | `descripcion_dano TEXT?`; `monto_estimado DECIMAL(12,2)?`; `moneda CHAR(3)?` | Daño narrado y estimación global no negativa, moneda exigida con importe; no inventario individualizado. |
| Protección estudiantil | `riesgo_inmediato BOOLEAN?`; `requiere_derivacion BOOLEAN?` | Información mínima, acceso restringido y seguimiento en actuaciones. |

No se crea tabla por categoría para unos pocos atributos escalares. No hay atributos genéricos ni JSON. Al confirmar, el backend conoce la categoría por tipo y exige los campos aprobados para ese formulario; rechaza valores ajenos. Esa comprobación entre tablas no es un CHECK de una sola fila. Cambiar categoría de un borrador/propuesta obliga a revisar sus campos específicos.

La institución debe validar obligatoriedad y vocabularios antes de congelar el esquema. El alcance actual es registrar el hecho y sus actuaciones, no administrar inventario o entidades receptoras. Si se exige identificar varios bienes o derivaciones con destinatarios reutilizables, deberán modelarse relaciones, nunca ocultarse en descripcion_dano o detalle. No se incorporan preventivamente funcionalidades inexistentes.

## 6. Relaciones y restricciones declarativas

- personas 1–0..1 usuarios y 1–0..1 estudiantes; estudiantes N–M personas apoderadas mediante estudiantes_apoderados, con periodos.
- roles 1–N usuarios y N–M permisos mediante roles_permisos. Roles históricos en incidencias/actuaciones/solicitudes/historial se mantienen aunque cambie el rol vigente.
- estudiantes 1–N matriculas; aulas 1–N matriculas. Personas 1–N versiones como reportantes.
- incidencias 1–N versiones; tipos 1–N versiones; versiones N–M estudiantes mediante involucrados.
- incidencias 1–N actuaciones, solicitudes, revisiones y conflictos; solicitudes 1–0..N revisiones y contienen 0..1 decisión final.
- revisiones N–M personas mediante participantes_revision, con como máximo un acta por revisión. Historial referencia actores y destinos de cada evento.

Claves y coherencia:

1. PK/FK/UQ según tablas; identificadores inmutables y `ON DELETE RESTRICT` para relaciones históricas. Sin cascadas de eliminación de expedientes. Desactivar maestros y cuentas.
2. FK compuesta `(id_incidencia, id_version_vigente)` desde incidencias y pares equivalentes base/propuesta desde solicitudes hacia `(id_incidencia, id)` de versiones. Nunca apuntan a hechos de otro expediente. El puntero vigente puede ser NULL durante creación transaccional; no después de confirmar.
3. FK `(id_estudiante, id_matricula)` desde involucrados a la UQ correspondiente de matriculas. Matrícula NULL cuando se desconoce el contexto; en otro caso debe ser del estudiante.
4. FK compuesta revisión–solicitud por `(id_incidencia, id_solicitud)` y solicitud–revisión resolutiva por `(id_incidencia, id_revision_resolutiva)`. La aplicación verifica además que la revisión citada pertenece a esa solicitud concreta, no solo al mismo expediente. Ambas referencias opcionales permiten crear las filas secuencialmente.
5. Correcciones de actuaciones y revisiones deben referenciar una fila anterior del mismo expediente, sin ciclos; usar las UQ por expediente para FK compuestas. La revisión complementaria conserva la misma solicitud si la anterior tenía una; backend verifica coherencia. Los destinos del historial se comprueban conjuntamente.
6. Dominios cerrados; versiones positivas; mínimo de estudiantes no negativo; intervalos con fin igual/posterior a inicio; importe no negativo y moneda coherente; documento completo o enteramente NULL; estudiante distinto de su propio apoderado.
7. Rectificación exige propuesta de versión distinta de base y/o confidencialidad; anulación no admite esas propuestas. Datos de duplicado solo en anulación con ese motivo; no se referencia a sí misma. La nueva versión debe pertenecer al mismo expediente y a una sola solicitud.
8. En aprobación/rechazo, decisor distinto del solicitante y datos de decisión completos; el estado no sustituye permisos. Para descartar un conflicto, resolutor distinto del afectado y resolución completa. Para inhibición declarada sin resolución, campos de resolutor permanecen NULL.
9. Reunión celebrada exige fecha; acta emitida exige texto/emisor/fecha juntos; cierre exige conclusión y fecha. Cuando se exige acta, el backend impide concluir sin ella. No usar la presencia de un acta para deducir automáticamente aprobación.

Índices: reutilizar PK/UQ y los necesarios para FK; añadir según consultas incidencias `(estado, prioridad, registrada_en)`, involucrados `(id_estudiante, id_version)`, estudiantes_apoderados `(id_apoderado, vigente_desde)`, solicitudes `(id_incidencia, estado)`, actuaciones `(id_incidencia, registrada_en)`, historial `(id_incidencia, ocurrido_en)` y conflictos `(id_incidencia, id_usuario_afectado, estado)`. Prioridad se ordena por significado explícito, no alfabéticamente. No indexar indiscriminadamente narrativas.

## 7. Reglas backend y flujos

Las restricciones de una fila no comprueban permisos, inmutabilidad, intervalos entre filas o independencia institucional. Implementar estas reglas con funciones claras, consultas parametrizadas y transacciones; no se necesitan triggers ni procedimientos almacenados en esta propuesta.

**R1. Identidad y permisos.** Comprobar sesión activa y una cuenta por persona verificada. Las FK/UQ evitan duplicar cuentas para el mismo id_persona; la validación humana evita registrar a la misma persona dos veces con otro ID, especialmente sin documento. El Administrador gestiona cuentas y permisos autorizados, nunca expedientes: no registra, modifica, anula, aprueba ni añade seguimiento. Un permiso configurable no elimina esa prohibición. Cambios sensibles de cuenta/rol requieren autorización institucional y auditoría; no se permite autoasignación para eludir restricciones. No asumir que el Administrador puede leer expedientes confidenciales.

**R2. Organización escolar.** Validar documentos admitidos, identidad provisional, niveles/grados y pertenencia de la matrícula al año lectivo. Impedir solapamientos de matrículas activas para un estudiante y periodos duplicados del mismo vínculo de apoderado mediante transacción. Propuesta: como máximo un apoderado principal por periodo, aunque haya varios responsables; regla por validar. Las FK no comprueban intervalos. Mantener las asignaciones históricas usadas en expedientes y auditar correcciones de maestros, sin reasignar una identidad o aula para hacerla pasar por otra.

**R3. Registro y confirmación.** El formulario permite corregir antes de confirmar; no se implementa autoguardado. Un guardado explícito de borrador, si se ofrece, requiere los campos comunes obligatorios de la tabla; no inventar valores para guardar datos incompletos. Estados de versión: borrador, propuesta, confirmada. Solo borrador permite editar hechos/involucrados. Confirmar valida reportante, categoría, mínimos, matrícula y permisos, fija confirmada_en, congela contenido e involucrados y registra historial. Usuario, rol e instante vienen de sesión/servidor. Las versiones confirmadas anteriores permanecen intactas; cuál está vigente se obtiene del puntero, sin banderas redundantes.

**R4. Rectificación y anulación.** Presentar una petición con justificación y versión base. Rectificar copia todos los hechos e involucrados a una propuesta completa e inmutable al presentarse; reducir confidencialidad puede solicitarse sin cambiar hechos. No se edita directamente una confirmada. Propuesta conservadora: Director o Subdirector competente e independiente resuelve, sujeto a validación de la matriz institucional. Nadie resuelve su propia solicitud, tampoco tras cambiar de rol; comprobar persona además de cuenta. Anular cambia estado a anulada y conserva todas las versiones, actuaciones y revisiones. Si es duplicado, enlaza al registro que permanece; no mueve ni fusiona datos.

Bloquear la fila de incidencia al confirmar/presentar/resolver. Solo una solicitud pendiente por expediente; asignar número de versión bajo el mismo bloqueo. Revalidar versión base, estado, autorización y conflictos dentro de la transacción. Una base obsoleta exige nueva evaluación, no una sobrescritura silenciosa. Decisión, estado de solicitud, versión vigente o anulación e historial se escriben atómicamente. La decisión no se edita; se conserva también toda propuesta rechazada/retirada. La fecha y autoridad de anulación se obtienen de la solicitud aprobada, sin duplicarlas.

**R5. Seguimiento.** Agregar actuaciones/observaciones autorizadas; corregirlas mediante otra actuación enlazada y justificada, no UPDATE del texto anterior. No usar seguimiento para modificar hechos. Cambios operativos a en_seguimiento/cerrada, prioridad o responsable se auditan; reapertura requiere permiso y motivo. Anulada no admite seguimiento ordinario ni restauración automática. Los plazos/responsables de actuaciones no constituyen un sistema de tareas nuevo.

**R6. Revisión e independencia.** Verificar conflictos declarados y los vínculos conocidos: reportante, persona involucrada, apoderado de un estudiante u otros intereses. Las relaciones ayudan a detectar candidatos a conflicto; la institución define criterios y una revisión humana complementa la detección, sin presumir que todos los parentescos relevantes están registrados. Pendiente/inhibido bloquean al afectado para decidir y para ejercer función decisora en revisiones. Puede ser oído como parte si el procedimiento lo permite; asistencia no da voto ni permiso. Resolver un conflicto exige independencia y autorización; el afectado no lo descarta.

La revisión formal se exige solo según criterios institucionales. Cuando corresponda, registrar personas, función, asistencia y acta; validar composición/quórum acordados antes de concluir. Antes de aprobar, comprobar que la revisión obligatoria esté concluida, que corresponda a la solicitud y que exista acta si era exigida. Una conclusión formal no sustituye la decisión independiente. Si Director y Subdirector están impedidos, la solicitud permanece pendiente y bloqueada por sus conflictos; registrar el bloqueo en historial. **No inventar un sustituto, otorgar facultad al Administrador ni aprobar automáticamente**: el colegio debe autorizar el procedimiento de escalamiento.

**R7. Confidencialidad y auditoría.** Niveles propuestos: interna, restringida. La matriz de permisos por rol distingue lectura/acción y acceso restringido, con denegación por defecto; pertenecer a la institución no concede acceso. Aplicar filtros en servidor a expediente, versiones, actuaciones, revisiones, historial, búsquedas y reportes. Elevar protección es una acción protectora auditada; bajarla exige solicitud independiente y validación de que la propuesta sigue siendo aplicable. Las lecturas de datos sensibles y exportaciones se auditan sin copiar todo el contenido. Alcance exacto por rol pendiente de aprobación.

Historial append-only en la misma transacción que la operación; sin actualizaciones ni borrados desde la aplicación. La cuenta SQL de ejecución no tendrá DDL ni DELETE sobre tablas históricas; restringir UPDATE del historial. RESTRICT por sí solo no impide borrar todas las filas ni protege el contenido de una versión: controles de servidor y privilegios son complementarios. Hash seguro de contraseñas, sesiones protegidas/cookies httpOnly, transporte y respaldos protegidos se implementarán después. No afirmar que ya existen ni que el esquema garantiza por sí solo confidencialidad.

## 8. Validación conceptual de los 15 casos

Se simulan referencias y transiciones; «cubierto» significa representable por la propuesta, no aprobado por el colegio ni probado mediante SQL.

| Caso | Tablas y recorrido | Resultado / condición pendiente |
| --- | --- | --- |
| 1. Auxiliar registra pelea reportada por docente | usuarios/roles identifica al auxiliar; incidencias guarda registrador; versiones referencia a la persona docente reportante; tipos e involucrados clasifican pelea y estudiantes. | Cubierto. Dos identidades separadas sin duplicarlas; validar permisos y tipo institucional. |
| 2. Docente registra desmayo | usuarios, incidencias, versiones con tipo salud, personas como reportante, involucrados con un estudiante, matriculas si se conoce. | Cubierto. Un estudiante basta; síntomas y atención inmediata son distintos de gravedad disciplinaria. |
| 3. Riesgo eléctrico sin estudiantes | incidencias, versiones y tipos de seguridad con mínimo cero; reportante en personas; involucrados no tiene filas. | Cubierto. No se exige estudiante ficticio ni dos participantes. |
| 4. Estudiante con dos apoderados | personas identifica a ambos; estudiantes y dos filas estudiantes_apoderados conservan vínculos y vigencia. | Cubierto. Sin límite artificial de un responsable. Regla de principal por validar. |
| 5. Madre con dos hijos matriculados | Una persona madre enlaza a dos estudiantes mediante estudiantes_apoderados; cada estudiante tiene matriculas hacia aulas. | Cubierto. No se duplica identidad de la madre ni del aula. |
| 6. Extranjero sin DNI | personas usa pasaporte/otro documento o código interno provisional; estudiantes conserva código escolar; matriculas referencia al estudiante. | Cubierto. No exige DNI; verificación y documentos admitidos pendientes de criterio institucional. |
| 7. Coordinador agrega actuación | usuarios/roles/roles_permisos validan acción; actuaciones referencia incidencia y autor; historial registra operación. | Cubierto. versiones e involucrados no se modifican. |
| 8. Docente solicita rectificación | solicitudes_cambio fija docente/base/justificación; versiones e involucrados guardan propuesta; revisiones si procede; autoridad decide y se registra historial. | Cubierto. Versión anterior se conserva; aprobador distinto, sin conflictos y con permiso. |
| 9. Director solicita y Subdirector resuelve | Solicitud guarda Director solicitante; usuarios/personas/roles identifican Subdirector decisor; conflictos se comprueban antes de la decisión. | Cubierto si Subdirector es competente y no tiene impedimento; Director no se autoaprueba. |
| 10. Reunión con participantes y acta | revisiones guarda fecha, conclusión y acta; participantes_revision relaciona personas de cualquier condición; solicitud cita revisión si aplica. | Cubierto sin lista de asistentes en texto. Criterios de composición, quórum y acta por validar. |
| 11. Anulación de duplicado | solicitudes_cambio de anulación referencia incidencia objetivo y otra incidencia que permanece; decisión independiente cambia estado a anulada; historial conserva evento. | Cubierto. Ninguna versión/actuación/acta se elimina ni fusiona. |
| 12. Autoridad se inhibe | conflictos_interes enlaza expediente/usuario afectado y declaración; historial registra inhibición; consultas de autorización bloquean sus decisiones. | Cubierto. La autoridad no puede descartar su propio conflicto; otro decisor solo actúa si es competente y ajeno al conflicto. |
| 13. Ambas autoridades impedidas | Dos conflictos bloquean Director/Subdirector para la solicitud; solicitudes_cambio queda pendiente e historial registra bloqueo. | Representación completa del bloqueo. **Resolución institucional pendiente**; no se inventa autoridad alternativa. |
| 14. Incidencia confidencial | incidencias.confidencialidad, usuarios/roles/permisos y conflictos determinan acceso; versiones/actuaciones/revisiones heredan ese ámbito; historial registra accesos sensibles. | Cubierto para acceso por rol/nivel con denegación por defecto. Aprobar matriz antes de habilitar lecturas; no confundir tabla con seguridad implementada. |
| 15. Salud y disciplina con datos distintos | tipos identifica categoría; versiones contiene columnas de salud o norma/gravedad; backend valida conjunto pertinente. | Cubierto sin JSON ni tablas por categoría. Obligatoriedad y vocabularios finales pendientes de revisión de formularios. |

Balance: **14 recorridos operativos representables y 1 bloqueo representable con resolución institucional pendiente**. No faltan relaciones para esos 15 escenarios dentro del alcance descrito. Las autorizaciones y reglas institucionales siguen siendo condiciones de implementación, no decisiones tomadas por este documento.

## 9. Decisiones pendientes de aprobación institucional

1. Aprobar la propuesta completa de 19 tablas, un rol vigente por cuenta y permisos por rol. Definir quién autoriza cambios sensibles de cuentas/roles sin permitir autoescalamiento del Administrador.
2. Acordar matriz de lectura/acción y acceso confidencial por rol, criterios de conflicto, autoridad competente para cada cambio y tratamiento cuando Director y Subdirector estén impedidos. No se propone un séptimo rol ni suplencia automática.
3. Determinar cuándo exigir revisión formal, reunión y acta; composición, funciones, quórum y procedimiento de subsanación. El modelo actual tiene una decisión final responsable, no votación colegiada individual ni firmas digitales.
4. Validar tipos por categoría, mínimos de estudiantes, campos obligatorios, vocabularios de gravedad/participación y protección de datos sensibles. Se propone un reportante por versión y una participación principal por estudiante, conservando las decisiones de diseño previas.
5. Precisar identificación extranjera/provisional, conciliación de identidades duplicadas, niveles/grados, vigencias de apoderados y regla de principal. No admitir DNI inventados.
6. Definir conservación y acceso a datos personales, historial y respaldos; tratamiento de errores de identidad sin reescribir quién figuraba en documentos históricos. Los borradores no tienen autoguardado en esta etapa.

## 10. Estabilidad y riesgos de cambios futuros

Las necesidades conocidas de identidad, apoderados múltiples, aulas, externos, participantes, versiones y auditoría ya tienen lugar en el modelo. No se posponen para añadir tablas durante cada funcionalidad. Ningún diseño puede garantizar cero cambios ante requisitos nuevos; estos límites deben revisarse antes de generar el esquema:

| Posible ampliación | Cambio que podría requerir y por qué no se incluye ahora |
| --- | --- |
| Varios reportantes por hecho o varias funciones simultáneas por estudiante | Relación de reportantes o ajuste de clave de involucrados. No se ha solicitado ese comportamiento; no usar listas en columnas para simularlo. |
| Permisos por expediente/persona, además de rol/nivel | Relación de concesiones específicas si el colegio exige selección individual de lectores. La propuesta cubre permisos por rol y confidencialidad, no ACL discrecional por caso. |
| Votos individuales, firmas electrónicas o varios documentos versionados por reunión | Relaciones de voto/firma/documento según procedimiento aprobado. No son equivalentes a acta narrativa y decisión responsable ya solicitadas. |
| Inventario y daños por bien, derivaciones a entidades registradas o seguimiento clínico | Detalles relacionales y catálogos especializados si esos nuevos objetos se administran. Hoy se registran hechos y actuaciones, no esos subsistemas. |
| Adjuntos o gestión de sesiones persistidas | Almacenamiento y metadatos a diseñar en su fase técnica, sin mezclar binarios o tokens con hechos/historial. PDFKit puede generar reportes mediante consultas sin exigir una tabla de reportes. |
| Nuevos campos escalares aprobados en formularios | Ajustar columnas/validaciones, normalmente sin añadir tablas. Confirmar los seis formularios antes del esquema para reducir retrabajo. |

Resumen: la propuesta cubre los requisitos relacionales conocidos y conserva seguridad/historia como obligaciones explícitas de implementación. Quedan pendientes decisiones institucionales, validación humana del diseño y, posteriormente, pruebas reales del esquema. **No se declara aprobado el modelo.** Solo database/DISENO.md se actualiza en esta tarea.
