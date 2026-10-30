# SICE-Local: diseño simplificado de la base de datos

Fase 2.1 · 30 de octubre de 2026 · **Propuesta pendiente de aprobación**.

Institución: I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete.

El objetivo son las **16 tablas solicitadas**. Se documenta esa base, pero no se declara suficiente: faltan las relaciones estudiantes–apoderados y participantes de revisiones del alcance original. La corrección mínima recomendada, manteniendo responsabilidades sencillas, añade dos tablas de relación: **18 tablas**. Esta ampliación es una propuesta, no una decisión aprobada. Aulas e identidad común requieren además definir su alcance.

Solo diseño documental: sin SQL ejecutable, migraciones, datos demo ni código. Las garantías indicadas deberán implementarse y probarse posteriormente.

## 1. Convenciones y decisiones de simplificación

- MySQL 8, InnoDB y utf8mb4; nombres en español, snake_case y sin tildes.
- `id`: PK `BIGINT UNSIGNED` autoincremental, salvo PK compuesta indicada. Las FK tienen el tipo de su destino. `UQ`: unicidad; `?`: admite NULL. Los demás campos son obligatorios.
- `DATE` para fechas civiles; `DATETIME(6)` para instantes UTC, presentados en America/Lima. Los instantes de registro los genera el servidor, a diferencia de la fecha de ocurrencia declarada.
- Códigos de dominio en `VARCHAR` con valores cerrados y restricciones; `BOOLEAN` limitado a 0/1. Documentos y teléfonos son texto, no números.
- Un rol vigente por usuario y permisos configurables por rol, sin excepciones individuales. Categorías, estados y prioridades son dominios fijos, sin tablas de catálogo adicionales.
- La decisión final se integra en solicitudes_cambio, pues hay como máximo una por solicitud. Cada revisión conserva su acta opcional; no se necesita una tabla separada para ese documento único.
- Sin tabla personas: usuarios, estudiantes y apoderados mantienen identidad propia. El reportante usa FK alternativas explícitas; las limitaciones de identidad transversal se reconocen en la sección 6.
- Sin tabla aulas: matriculas guarda año/nivel/grado/sección como contexto histórico estructurado. Esto no equivale a un catálogo de aulas con integridad referencial.
- No utilizar JSON, listas de IDs, columnas repetidas ni referencias genéricas sin FK para representar relaciones. El texto narrativo es válido para hechos, motivos y actas, pero no sustituye participantes, apoderados, votos o bienes individualizados.

## 2. Las 16 tablas objetivo

### Acceso y organización escolar

| N.º | Tabla y finalidad | Columnas principales |
| --- | --- | --- |
| 1 | `roles`: seis perfiles institucionales | `id`; `codigo VARCHAR(30) UQ`; `nombre VARCHAR(60) UQ` |
| 2 | `usuarios`: cuentas del personal | `id`; `id_rol FK roles`; `nombres VARCHAR(100)`; `apellidos VARCHAR(150)`; `tipo_documento VARCHAR(20)?`; `numero_documento VARCHAR(40)?`; `pais_documento CHAR(2)?`; `nombre_usuario VARCHAR(60) UQ`; `contrasena_hash VARCHAR(255)`; `activo BOOLEAN`; `creado_en DATETIME(6)` |
| 3 | `permisos`: acciones configurables autorizadas | `id`; `codigo VARCHAR(80) UQ`; `descripcion VARCHAR(255)` |
| 4 | `roles_permisos`: concesiones de permisos | `id_rol FK roles`; `id_permiso FK permisos`; PK `(id_rol, id_permiso)` |
| 5 | `estudiantes`: identidad de estudiantes varones | `id`; `codigo_estudiante VARCHAR(30) UQ`; `nombres VARCHAR(100)`; `apellidos VARCHAR(150)`; `tipo_documento VARCHAR(20)?`; `numero_documento VARCHAR(40)?`; `pais_documento CHAR(2)?`; `fecha_nacimiento DATE?`; `activo BOOLEAN` |
| 6 | `apoderados`: identidad de responsables | `id`; `codigo_apoderado VARCHAR(30) UQ`; `id_usuario FK usuarios? UQ`; `nombres VARCHAR(100)`; `apellidos VARCHAR(150)`; `tipo_documento VARCHAR(20)?`; `numero_documento VARCHAR(40)?`; `pais_documento CHAR(2)?`; `telefono VARCHAR(30)?`; `correo VARCHAR(254)?`; `activo BOOLEAN` |
| 7 | `matriculas`: ubicación escolar histórica | `id`; `id_estudiante FK estudiantes`; `anio_lectivo SMALLINT UNSIGNED`; `nivel VARCHAR(20)`; `grado TINYINT UNSIGNED`; `seccion VARCHAR(20)`; `fecha_inicio DATE`; `fecha_fin DATE?`; UQ `(id_estudiante, fecha_inicio)` y `(id_estudiante, id)` |

Roles: Director, Subdirector, Coordinador de Tutoría, Docente, Auxiliar y Administrador. Director y Subdirector son las máximas autoridades; la jerarquía no se deduce de sus identificadores.

El Administrador gestiona cuentas y permisos dentro de facultades autorizadas; no registra, modifica, anula, aprueba ni agrega actuaciones a incidencias. Ningún permiso configurable anula esa restricción, la independencia o la confidencialidad. Cambios sensibles de rol/permisos requieren autorización institucional y auditoría; no se permite autoasignación para eludir prohibiciones.

En cada tabla de identidad, los tres campos documentales se completan juntos o quedan juntos en NULL. UQ `(pais_documento, tipo_documento, numero_documento)` cuando se conocen; normalizar formato. Admitir DNI, carné de extranjería, pasaporte u otro documento autorizado. Un estudiante extranjero sin DNI usa su documento disponible o código interno con identidad provisional por verificar; nunca un DNI ficticio. La condición de estudiantes varones no se extiende a usuarios, apoderados o reportantes.

`apoderados.id_usuario` enlaza al responsable que también tiene cuenta de personal, sin exigir cuentas a todos los apoderados. La duplicación de identidad entre ambos perfiles requiere conciliación y auditoría; no se presenta como normalización perfecta. **Falta todavía el vínculo con los estudiantes**: no se fuerza un único responsable ni se duplica al apoderado por cada hijo.

### Incidencias y versiones

| N.º | Tabla y finalidad | Columnas principales |
| --- | --- | --- |
| 8 | `tipos_incidencia`: clasificación específica y categoría fija | `id`; `categoria VARCHAR(30)`; `nombre VARCHAR(100)`; `minimo_estudiantes SMALLINT UNSIGNED`; `activo BOOLEAN`; UQ `(categoria, nombre)` |
| 9 | `incidencias`: identidad estable, autoría inicial y estado operativo | `id`; `id_registrador FK usuarios`; `id_rol_registrador FK roles`; `nombre_registrador VARCHAR(251)` histórico; `registrada_en DATETIME(6)`; `confirmada_en DATETIME(6)?`; `estado VARCHAR(20)`; `prioridad VARCHAR(10)`; `confidencialidad VARCHAR(20)`; `id_version_vigente BIGINT UNSIGNED?` |
| 10 | `versiones_incidencia`: borrador, propuesta o hechos confirmados | `id`; `id_incidencia FK incidencias`; `numero_version INT UNSIGNED`; `estado_version VARCHAR(20)`; `id_autor FK usuarios`; `creada_en DATETIME(6)`; `id_tipo FK tipos_incidencia`; `titulo VARCHAR(200)`; `descripcion TEXT`; `ocurrida_en DATETIME(6)?`; `lugar VARCHAR(255)?`; `gravedad_disciplinaria VARCHAR(20)?`; campos de reportante y categoría detallados abajo; UQ `(id_incidencia, numero_version)` y `(id_incidencia, id)` |
| 11 | `involucrados`: estudiantes de cada versión | `id_version FK versiones_incidencia`; `id_estudiante FK estudiantes`; `id_matricula BIGINT UNSIGNED?`; `participacion VARCHAR(30)`; PK `(id_version, id_estudiante)` |
| 12 | `actuaciones`: acciones y observaciones de seguimiento | `id`; `id_incidencia FK incidencias`; `id_autor FK usuarios`; `id_rol_autor FK roles`; `tipo VARCHAR(20)`; `detalle TEXT`; `realizada_en DATETIME(6)`; `registrada_en DATETIME(6)`; `id_responsable FK usuarios?`; `fecha_limite DATE?`; `id_actuacion_corregida FK actuaciones?` |

Estados de incidencia: `borrador`, `confirmada`, `en_seguimiento`, `cerrada`, `anulada`. Prioridades: `baja`, `normal`, `alta`, `urgente`. Gravedad disciplinaria: NULL si no aplica; en otro caso `por_evaluar`, `leve`, `grave`, `muy_grave`, sujeto a validación institucional. Una urgencia de salud no implica gravedad disciplinaria. Tipos de actuación: `actuacion` y `observacion`.

El registrador, su rol, nombre histórico e instante se obtienen de sesión/servidor, nunca del formulario. Su identidad inicial no se sustituye al rectificar; el autor de cada nueva versión se conserva por separado.

Cada versión incorpora columnas para **un reportante independiente**:

- `tipo_reportante VARCHAR(20)`: `personal`, `estudiante`, `apoderado` o `externo`.
- `id_reportante_usuario FK usuarios?`, `id_reportante_estudiante FK estudiantes?`, `id_reportante_apoderado FK apoderados?`.
- `nombre_reportante VARCHAR(251)` histórico obligatorio; `contacto_reportante VARCHAR(254)?`, solo si es necesario y con acceso restringido.

Para personal/estudiante/apoderado se exige exactamente la FK correspondiente, con las otras dos NULL. Para externo, las tres son NULL; el nombre conserva la identidad declarada en ese hecho, sin crear una entidad externa reutilizable. Esa instantánea histórica es deliberada, no una relación oculta. Personal sin cuenta no debe etiquetarse falsamente como externo: es una limitación pendiente de identidad común. Reportantes anónimos o múltiples requieren una decisión de alcance.

`involucrados` pertenece a la **versión**, preservando el conjunto anterior al rectificar. Se admiten cero filas, una o varias; el mínimo se verifica por tipo al confirmar y puede ser cero. Participaciones propuestas: `afectado`, `testigo`, `involucrado`, sin presumir responsabilidad. Se propone una participación principal por estudiante y versión; varias simultáneas exigirían ajustar la clave.

Cuando exista matrícula, `(id_estudiante, id_matricula)` será FK a la UQ equivalente de matriculas. No se acepta una matrícula ajena ni se infiere el aula histórica desde la matrícula actual.

### Solicitudes, revisiones y control

| N.º | Tabla y finalidad | Columnas principales |
| --- | --- | --- |
| 13 | `solicitudes_cambio`: petición y única resolución final | `id`; `id_incidencia FK incidencias`; `id_solicitante FK usuarios`; `id_rol_solicitante FK roles`; `tipo VARCHAR(20)`; `justificacion TEXT`; `creada_en DATETIME(6)`; `estado VARCHAR(20)`; `id_version_base BIGINT UNSIGNED`; `id_version_propuesta BIGINT UNSIGNED? UQ`; `confidencialidad_propuesta VARCHAR(20)?`; `requiere_revision BOOLEAN`; `motivo_revision VARCHAR(500)?`; `id_revision_resolutiva BIGINT UNSIGNED?`; `id_decisor FK usuarios?`; `id_rol_decisor FK roles?`; `fundamento_decision TEXT?`; `decidida_en DATETIME(6)?`; UQ `(id_incidencia, id)` |
| 14 | `revisiones`: evaluación formal y acta opcional | `id`; `id_incidencia FK incidencias`; `id_solicitud BIGINT UNSIGNED?`; `id_responsable FK usuarios`; `motivo TEXT`; `abierta_en DATETIME(6)`; `cerrada_en DATETIME(6)?`; `estado VARCHAR(20)`; `hubo_reunion BOOLEAN`; `reunion_en DATETIME(6)?`; `requiere_acta BOOLEAN`; `fundamento_acta VARCHAR(500)`; `acta TEXT?`; `id_emisor_acta FK usuarios?`; `acta_emitida_en DATETIME(6)?`; `conclusion TEXT?`; `id_revision_anterior FK revisiones? UQ`; UQ `(id_incidencia, id)` |
| 15 | `historial`: eventos y cambios auditados | `id`; `id_incidencia FK incidencias?`; `id_actor FK usuarios`; `id_rol_actor FK roles`; `ocurrido_en DATETIME(6)`; `accion VARCHAR(60)`; `id_usuario_afectado FK usuarios?`; `id_rol_afectado FK roles?`; `id_permiso_afectado FK permisos?`; `id_solicitud FK solicitudes_cambio?`; `id_revision FK revisiones?`; `campo VARCHAR(60)?`; `valor_anterior TEXT?`; `valor_nuevo TEXT?`; `motivo TEXT?` |
| 16 | `conflictos_interes`: impedimentos e inhibiciones por incidencia | `id`; `id_incidencia FK incidencias`; `id_usuario_afectado FK usuarios`; `id_declarante FK usuarios`; `motivo TEXT`; `declarado_en DATETIME(6)`; `estado VARCHAR(20)`; `id_resolutor FK usuarios?`; `resuelto_en DATETIME(6)?`; `fundamento_resolucion TEXT?` |

Tipos de solicitud: `rectificacion`, `anulacion`. Estados: `pendiente`, `aprobada`, `rechazada`, `retirada`, `obsoleta`. Decisor, rol, fundamento y fecha se completan juntos únicamente al aprobar/rechazar. La decisión final es inmutable; una nueva petición usa otra fila. No hace falta una tabla de decisiones para esta relación 1–0..1.

Revisiones: `abierta`, `concluida`; pueden evaluar una incidencia o una solicitud. No toda incidencia requiere revisión, no toda revisión requiere reunión ni toda reunión acta. Los criterios institucionales decidirán cuándo son obligatorias. Fecha de reunión obligatoria si hubo reunión; acta, emisor y fecha obligatorios juntos si se emite, y antes de concluir si se exige. Conclusión y fecha de cierre son obligatorias al concluir.

Revisión concluida y acta emitida son inmutables. Una subsanación crea revisión complementaria enlazada a la anterior, conservando ambas sin alterar decisiones previas. Esta simplificación no modela varias ediciones independientes de acta en una revisión ni firmas individuales. **El texto del acta no reemplaza las relaciones de participantes que faltan.**

Conflictos: `pendiente`, `inhibido`, `descartado`. Pendiente e inhibido bloquean decisiones del afectado; descarte exige resolución independiente fundamentada. El afectado no resuelve su propio conflicto. Se aplican a todas las solicitudes/revisiones de la incidencia aunque cambie el rol del usuario.

El historial registra estados, prioridad, permisos, solicitudes y decisiones; los hechos completos están en versiones. Sus valores anterior/nuevo son escalares o narrativos, nunca listas de relaciones; permisos y actores usan sus FK. No guardar contraseñas, hashes ni tokens. Otros eventos que necesiten referenciar una entidad deberán añadir la FK concreta, no esconder el vínculo en motivo.

## 3. Seis categorías y campos pertinentes

`tipos_incidencia.categoria` admite exactamente `convivencia`, `disciplina`, `salud`, `seguridad`, `bienes`, `proteccion_estudiantil`. Se obtiene por el tipo, sin duplicarla en versiones. Un tipo usado no cambia de significado o categoría; se desactiva y se crea otro.

Campos escalares propuestos en versiones_incidencia, además de descripción, fecha, lugar y reportante comunes:

| Categoría | Columnas específicas | Alcance y validación |
| --- | --- | --- |
| Convivencia | `ambito_convivencia VARCHAR(20)?`; `requiere_mediacion BOOLEAN?` | Ámbito: `presencial`, `digital`, `mixto`. Estudiantes vinculados mediante involucrados, no mediante nombres en texto. |
| Disciplina | `norma_referida VARCHAR(100)?`; `gravedad_disciplinaria VARCHAR(20)?` | Referencia normativa histórica; no catálogo de sanciones ni responsabilidad presunta. Gravedad independiente de prioridad. |
| Salud | `sintomas_observados TEXT?`; `requiere_atencion_inmediata BOOLEAN?` | Observaciones del hecho, no historia clínica ni diagnósticos inventados. Atención posterior en actuaciones. |
| Seguridad | `riesgo_identificado TEXT?`; `riesgo_persistente BOOLEAN?` | Riesgo narrado y un indicador por hecho; no listas de entidades que necesiten FK. |
| Bienes | `descripcion_dano TEXT?`; `monto_estimado DECIMAL(12,2)?`; `moneda CHAR(3)?` | Estimación total no negativa; moneda obligatoria con importe. No representa inventario ni daños por bien individualizado. |
| Protección estudiantil | `riesgo_inmediato BOOLEAN?`; `requiere_derivacion BOOLEAN?` | Datos mínimos y acceso restringido. Acciones posteriores en actuaciones, sin listas de destinatarios que requieran relación. |

Son columnas anulables por categoría, no una tabla genérica de atributos. Al confirmar se exigen los campos acordados y se rechazan valores ajenos al formulario. Como la categoría está en otra tabla, esta validación corresponde al servidor y a la transacción, no a un CHECK entre tablas. Cambiar de tipo en borrador/propuesta obliga a revisar sus campos específicos.

Queda pendiente acordar campos obligatorios por formulario. Si se requieren varios bienes con código/custodio/daño individual, o derivaciones a entidades registradas, se necesitan relaciones adicionales; los textos no pueden sustituirlas. No se da por cubierto un formulario cuyo contenido aún no está definido.

## 4. Relaciones, integridad y seguridad

### Cardinalidades

- roles 1–N usuarios; roles N–M permisos mediante roles_permisos.
- estudiantes 1–N matriculas. Estudiantes N–M apoderados **no está representado** en el objetivo de 16.
- usuarios 1–N incidencias como registradores; incidencias 1–N versiones; tipos_incidencia 1–N versiones.
- versiones N–M estudiantes mediante involucrados; un reportante por versión mediante una alternativa explícita.
- incidencias 1–N actuaciones, solicitudes, revisiones, historial y conflictos. Solicitudes 1–0..N revisiones y 0..1 decisión integrada.
- Un responsable o emisor de acta no equivale al conjunto de participantes de una revisión; ese N–M está pendiente.

Los pares `(id_incidencia, id_version_vigente/base/propuesta)` usarán FK compuestas hacia `(id_incidencia, id)` de versiones. Aplicar el mismo patrón a revisión–solicitud y solicitud–revisión resolutiva, impidiendo cruces de incidencias. El servidor comprueba además que la revisión resolutiva corresponde a esa solicitud concreta. Las autorreferencias de actuaciones y revisiones apuntan a una fila anterior del mismo expediente, sin ciclos. El historial valida la coherencia de sus referencias de contexto.

### Restricciones declarativas previstas

- PK, FK, UQ y obligatoriedad indicadas; `ON DELETE RESTRICT` en relaciones históricas, sin cascadas. Cuentas y catálogos se desactivan.
- Versiones positivas, mínimos de estudiantes no negativos, fechas finales no anteriores a iniciales, importes no negativos, códigos/indicadores restringidos a su dominio.
- Combinación de FK del reportante según tipo; identidad documental completa o enteramente NULL.
- Anulación sin versión/confidencialidad propuestas. Rectificación con al menos una de ambas; versión propuesta distinta de base. Decisor distinto del solicitante cuando exista y datos de resolución completos según estado.
- Conflicto resuelto con fundamento, fecha y resolutor distinto del afectado; estados no sustituyen autorización ni control de transiciones.
- Puntero vigente NULL solo durante creación o borrador sin versión. Una confirmada debe terminar la transacción con versión vigente válida; esta condición entre filas requiere servidor.

### Controles de servidor y transacciones

Las FK no garantizan independencia, inmutabilidad ni permisos. Se implementarán validaciones y transacciones con SQL parametrizado, sin triggers ni procedimientos almacenados innecesarios.

1. Estados de versión: `borrador`, `propuesta`, `confirmada`. Solo borrador admite edición de contenido e involucrados. Al presentar una propuesta se congela; aprobar cambia su estado y el puntero vigente, conservando versiones anteriores. No duplicar un indicador vigente por versión.
2. Persistir borradores con campos comunes obligatorios completos; se pueden corregir antes de confirmar. Autoguardado incompleto pendiente; no fabricar personas/documentos para satisfacer restricciones.
3. Bloquear la incidencia al confirmar, presentar o resolver. Una solicitud pendiente por incidencia, numeración única y validación de versión base dentro de la transacción. Una base obsoleta exige reevaluación; nunca sobrescribir cambios concurrentes.
4. Director o Subdirector independientes resuelven solicitudes, como propuesta inicial. Nadie aprueba su propia petición, tampoco tras cambiar de rol. Exigir una cuenta por persona verificada: nombre_usuario único no evita dos cuentas de la misma autoridad. Si ambos están impedidos, bloquear y escalar según procedimiento pendiente; no trasladar facultades al Administrador.
5. Bloquear afectados por conflicto pendiente/inhibición. Evaluar reportante, parentesco y demás intereses con validación humana complementaria. Sin estudiantes_apoderados no se puede detectar automáticamente el parentesco registrado: conflictos_interes por sí sola no cubre esa carencia.
6. No aprobar sin revisión obligatoria concluida o acta exigida. Participar no concede facultad de decidir. La comprobación relacional de participantes/quórum está bloqueada hasta corregir el modelo.
7. Decisión, solicitud, versión vigente o anulación e historial se actualizan atómicamente. Conservar propuestas rechazadas/retiradas; no eliminar físicamente confirmados, decisiones, actuaciones, revisiones ni auditoría.
8. Actuaciones se agregan; una corrección referencia la anterior y explica el motivo, sin alterar hechos. Prioridad/estado operativo cambian con permiso y auditoría. Hechos, estudiantes, reportante, clasificación y gravedad solo por rectificación. Confidencialidad `interna` o `restringida`: elevar protección es auditable; reducirla requiere aprobación independiente mediante confidencialidad_propuesta.
9. Restringir consultas, versiones, actuaciones, historial y reportes por permiso y confidencialidad. Administrar cuentas no concede acceso al expediente. Hash seguro de contraseñas, sesiones protegidas, cookies httpOnly, transporte y respaldos protegidos se implementarán en sus fases; no los garantiza el esquema.
10. Matrículas sin periodos superpuestos; conservar contexto histórico. Cuenta SQL sin DDL ni DELETE en tablas históricas. RESTRICT no impide por sí solo todos los borrados; los privilegios tampoco sustituyen el control de UPDATE.

Índices previstos además de PK/UQ y FK: incidencias `(estado, prioridad, registrada_en)`; involucrados `(id_estudiante, id_version)`; solicitudes_cambio `(id_incidencia, estado)`; actuaciones `(id_incidencia, registrada_en)`; historial `(id_incidencia, ocurrido_en)`; conflictos_interes `(id_incidencia, id_usuario_afectado, estado)`. Ordenar prioridad por significado explícito en la consulta, no alfabéticamente. Reutilizar índices existentes y ajustar a consultas reales.

## 5. Flujos

**Registro:** crear borrador con registrador automático, reportante independiente y cero o varios estudiantes. Permitir correcciones antes de confirmar. La confirmación valida formulario, mínimos, referencias y permisos; congela hechos e involucrados, fija fecha de servidor y estado confirmada y registra historial en una transacción.

**Seguimiento:** agregar actuaciones y observaciones; pasar a en_seguimiento/cerrada sin reescribir hechos. Reabrir exige permiso y motivo. Una anulada no admite seguimiento ordinario ni restauración automática.

**Rectificación:** presentar justificación, versión base y nueva versión completa con involucrados, o cambio de confidencialidad. Evaluar conflictos y necesidad de revisión/reunión/acta. Una autoridad independiente decide con fundamento. Solo la aprobación aplica el cambio, conservando toda evidencia anterior.

**Anulación:** solicitar sobre incidencia confirmada, en seguimiento o cerrada, con justificación y los mismos controles de independencia. Aprobar cambia estado a anulada, conserva el expediente y registra resolución e historial. Fecha y autoridad se consultan desde la solicitud aprobada, sin duplicarlas en incidencias.

## 6. Verificación del límite de 16 y correcciones mínimas

### A. Relación estudiantes–apoderados: falta una tabla

Ejemplo: Ana representa a Luis y Pedro; Luis también tiene a Carlos como apoderado. Un id_estudiante en apoderados obliga a duplicar a Ana. Un id_apoderado en estudiantes excluye a Carlos. Listas de IDs o columnas apoderado_1/apoderado_2 no representan correctamente el N–M ni su vigencia.

Corrección mínima propuesta: **`estudiantes_apoderados`** con `id_estudiante FK estudiantes`, `id_apoderado FK apoderados`, `vigente_desde DATE`, `vigente_hasta DATE?`, `vinculo VARCHAR(30)` y `es_principal BOOLEAN`; PK `(id_estudiante, id_apoderado, vigente_desde)`. Validar fechas y periodos de responsable principal sin solapamiento. El vínculo tiene vigencia propia; no debe depender solo de una incidencia o matrícula.

### B. Participantes de revisión: falta una tabla

Ejemplo: una revisión reúne a Subdirector, docente, estudiante y apoderada; la misma apoderada participa en otra revisión. El responsable único no permite representar asistencia, función o impedimentos de cada integrante. Nombres dentro del acta pierden integridad referencial, aunque sean válidos como narración documental.

Corrección mínima propuesta: **`participantes_revision`** con `id` PK, `id_revision FK revisiones`, `id_usuario FK usuarios?`, `id_estudiante FK estudiantes?`, `id_apoderado FK apoderados?`, `funcion VARCHAR(40)`, `asistio BOOLEAN` e `intervencion TEXT?`. Exactamente una FK de identidad debe existir. UQ por `(id_revision, id_usuario)`, `(id_revision, id_estudiante)` y `(id_revision, id_apoderado)`. Para un apoderado con cuenta se utiliza id_usuario como identidad canónica, comprobando apoderados.id_usuario para evitar doble participación de la misma persona. Participantes externos sin identidad registrada requieren el ajuste adicional indicado abajo.

Las dos adiciones dan **18 tablas recomendadas, pendientes de aprobación**. No se sobrecarga involucrados con asistentes o vínculos familiares: mezclar estudiantes de una versión, participantes de una revisión y apoderados en una sola tabla produciría significados distintos y restricciones más complejas. Mantener exactamente 16 exige reducir requisitos o rediseñar responsabilidades; no se oculta esa elección.

### Otros límites condicionados al alcance

| Caso | Capacidad actual y riesgo | Corrección mínima si se necesita |
| --- | --- | --- |
| Aulas | Año/nivel/grado/sección quedan en matriculas; no hay FK a un aula existente. «A» y «AA» podrían representar un error o dos grupos diferentes. | Si se administran aulas, cupos o tutores, añadir `aulas` y referenciarla desde matriculas: serían 19 con las dos correcciones anteriores. Si solo es contexto histórico, aprobar explícitamente dominios y limitación. |
| Identidad transversal | Usuario/apoderado se enlazan, pero no existe unicidad documental entre todas las tablas. Dos cuentas de la misma autoridad podrían eludir una comparación de IDs. | Verificación de una cuenta por persona para el alcance limitado. Si se exige integridad común, personal sin cuenta o participantes externos reutilizables, añadir `personas` y trasladar identidades/FK a ella, sin cuentas ficticias; reevaluar total junto con aulas. |
| Reportantes externos | Una instantánea por versión, sin continuidad relacional entre expedientes. | Identidad común si se requiere esa continuidad. Anonimato o varios reportantes necesitan diseño explícito. |
| Bienes/derivaciones múltiples | Los campos describen un hecho, no objetos/destinatarios individualizados. Dos equipos con custodios distintos no se modelan mediante un importe total. | Añadir relación de detalle y catálogo de destino cuando el formulario lo requiera. No usar descripcion_dano ni actuaciones.detalle como listas sustitutivas. |
| Decisión colegiada y firmas | Hay un decisor responsable; el acta no permite votos ni firmas verificables por integrante. | Modelar voto por participante/revisión si se exige; firmas múltiples requieren relación propia. No declarar esa capacidad cubierta por texto. |

### Resultado de la comprobación

| Regla | Evaluación del objetivo de 16 |
| --- | --- |
| Seis roles y Administrador sin facultades sobre incidencias | Representable; requiere matriz y restricciones de servidor. |
| Registrador automático y reportante independiente | Representable con FK alternativas y un reportante; pendientes identidad transversal y personal sin cuenta. |
| Borrador editable, hechos versionados y cero o varios estudiantes | Representable; involucrados se conserva por versión. |
| Rectificación/anulación justificadas e independientes | Representable con decisión integrada, sujeto a identidad verificada y transacciones. |
| Reuniones y actas cuando correspondan | Documento y revisión representables; participantes/asistencia/quórum no están completos. |
| Conflictos e inhibición | Declaración y bloqueo representables; falta relación familiar para comprobar conflictos de apoderados. |
| Identificación extranjera sin DNI | Representable con documento alternativo o código interno sin DNI ficticio. |
| Seis categorías con campos pertinentes | Base escalar propuesta; obligatorios y relaciones de detalle pendientes de validar. |
| Relaciones escolares y de revisión completas | No: faltan dos N–M y aulas depende del alcance aceptado. |

## 7. Decisiones pendientes y estado

1. Revisar la ampliación mínima a 18 tablas para conservar apoderados N–M y participantes. El modelo de 16 **no se da por aprobado** mientras falten esas relaciones del alcance original.
2. Decidir si aulas es catálogo administrado y si se necesita identidad común; 18 no es garantía de cubrir ampliaciones todavía indefinidas.
3. Validar permisos, autorización de cambios de cuenta/rol, confidencialidad y escalamiento cuando Director y Subdirector estén impedidos.
4. Acordar cuándo exigir revisión/reunión/acta, composición, quórum, votos, firmas y subsanaciones documentales.
5. Confirmar campos obligatorios por categoría, tipos, mínimos, gravedad disciplinaria, participación principal y tratamiento de reportantes anónimos/múltiples.
6. Definir autoguardado incompleto, retención de borradores, datos personales, auditoría y respaldos; sin eliminación física de confirmados.

Se revisaron documentalmente cardinalidades, identidad, versiones y escenarios de aprobación. **No se ejecutó SQL ni se creó ninguna tabla.** Resolver las decisiones anteriores antes de generar el esquema.
