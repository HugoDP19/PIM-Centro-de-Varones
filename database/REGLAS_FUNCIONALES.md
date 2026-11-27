# SICE-Local: reglas funcionales y pendientes institucionales

## Ampliación autorizada — 20 de noviembre de 2026

Se implementan en desarrollo presentación, evaluación, decisión documental, rechazo y retirada de rectificaciones/anulaciones, cierre y reapertura. D/SD deciden independientemente del solicitante por persona y cuenta; DO/AU solo solicitan dentro de su ámbito propio y AD no accede a expedientes. Las propuestas y sus participantes no sustituyen la versión vigente hasta aprobarse. Se conserva toda versión, incluso en ediciones de borrador, sin eliminar participantes previos. Las operaciones sensibles requieren contraseña actual, límites de intentos y sesión/rol/permisos vigentes en la transacción.

La resolución documental se limita a errores materiales de título/lugar y duplicados comprobados con referencia válida. Cambios de hechos, participantes, clasificación y reducción de confidencialidad requieren revisión formal; no pueden marcarse como documentales para eludirla. El usuario indicó que definirá composición y quórum: hasta recibirlos, la aprobación formal continúa bloqueada. No se inventa acta, quórum ni suplencia. Las evidencias reservadas conservan su protección.

Cerrar requiere D/SD o CT dentro del ámbito, motivo, declaración de revisión de actuaciones/plazos y ausencia de solicitudes pendientes; añade una actuación de conclusión. Reabrir exige los mismos permisos y motivo, y añade evidencia. Nunca permite restaurar una anulación lógica. Se registran ambos cambios en historial sin sobrescribir actuaciones.

El alcance autorizado el 27 de noviembre de 2026 comprende registro y edición de estudiantes y apoderados, búsqueda, matrículas y asociación del principal para Director, Subdirector y Coordinador de Tutoría, mediante el permiso existente `estudiantes.crear`. Se insertan identidad, perfil estudiantil, matrícula y auditoría atómicamente; código único y estable, aula activa y fecha correspondiente al año lectivo. Administrador, Docente y Auxiliar no acceden a esta gestión.

Documento opcional: DNI, carnet de extranjería o pasaporte con país emisor; sin documento se usa la identidad provisional y verificación humana. No hay fusión automática. Se conserva la identidad usada en expedientes, cuentas o revisiones; el contacto puede actualizarse. Las nuevas matrículas y sustituciones del principal conservan relaciones anteriores y añaden períodos sin superposición, con reautenticación y auditoría. Las fechas tienen precisión de día y no admiten dos sustituciones en el mismo día. No se habilitan gestión general de catálogos, DNI inventados ni corrección directa de identidades históricas. Las consultas y ediciones respetan la reserva escolar, incluidos apoderados compartidos con estudiantes protegidos.

## Gestión de cuentas autorizada — 17 de noviembre de 2026

Esta actualización sustituye el flujo de cuentas del 2 de noviembre, por instrucción expresa del usuario. Administrador, Director y Subdirector solicitan cambios; D y SD requieren aprobación recíproca. Para solicitudes de AD: activación/desactivación/restablecimiento se resuelven con la primera decisión válida; rol/permisos requieren registrar las dos decisiones. D y SD aprueban: aprobada; D rechaza: rechazada una vez registradas ambas; D aprueba y SD rechaza: revisión por desacuerdo bloqueada.

AD puede crear directamente cuentas operativas inactivas para personal existente y editar su nombre de acceso. No se modifica la identidad escolar. Para cuentas de autoridad/AD se exige solicitud independiente; su creación por solicitud de AD requiere ambas autoridades. La activación siempre es una operación independiente. No se permiten cambios propios ni permisos del propio rol, aprobación y ejecución por la misma persona, eliminación física o acceso de AD a expedientes.

Decidir requiere reautenticación, fundamento y declaración de ausencia de conflicto; rechazar sin fundamento no es válido. Operaciones exactas, plazo de 24 horas desde la solicitud, estado vigente del objetivo y actores, ejecución única y auditoría. Se revalida la sesión dentro de la transacción. Los cambios de cuenta y permisos revocan sesiones. Se conserva al menos una cuenta activa de cada autoridad y de Administrador; no se retiran permisos esenciales de sesión o gestión de esos roles.

Sin procedimiento excepcional: si falta la autoridad independiente o tiene conflicto, se bloquea la decisión. Una revisión por desacuerdo no tiene ruta de desbloqueo unilateral; su resolución institucional documentada sigue pendiente. Se mantienen las restricciones de desarrollo/producción y todos los límites de expedientes.

## Aplicación autorizada para desarrollo — 2 de noviembre de 2026

El usuario autoriza aplicar en desarrollo: matriz D/SD internos/restringidos, CT internos, DO/AU internos propios y AD sin expedientes; permiso específico por acción; bloqueo por conflicto; reserva de Salud/Protección y contenido sensible. Autoriza también los campos O/C del formulario y el mínimo estudiantil por tipo, con respuestas booleanas explícitas, sin diagnósticos ni gravedad disciplinaria en otras categorías. Estas respuestas no aprueban los procedimientos institucionales de producción.

Los límites por rol prevalecen sobre cualquier concesión configurable; el flujo vigente de cuentas se describe en la primera sección.

Implementados registro, edición de borrador propio, confirmación, consulta dentro del ámbito, actuaciones/observaciones por adición, historial y PDF con permiso separado. El seguimiento sensible eleva la protección atómicamente; el usuario sin acceso posterior recibe constancia. El clasificador de sensibilidad es una declaración explícita del registrador, además de los mínimos de categoría; no se presenta como detección automática del contenido narrativo.

Se confirma el alcance de testigos adultos mediante personas, con matrícula solo estudiantil y reserva del expediente completo. No se habilita acceso parcial. La ampliación de expedientes vigente se describe al inicio; revisión formal con acta, escalamiento por doble impedimento, conservación y gestión general de catálogos siguen pendientes. En producción las rutas de gestión devuelven 503 hasta validar institucionalmente su habilitación.

Las secciones siguientes detallan reglas y procedimientos pendientes de aprobación; no todas tienen rutas implementadas. El estado técnico vigente se documenta en [README.md](../README.md) y el modelo en [DISENO.md](DISENO.md).

## Estado de las reglas

- **Acordado para el proyecto:** seis roles; AD solo administra cuentas y permisos autorizados, sin acceso al contenido de incidencias; autoría automática y reportante independiente; corrección antes de confirmar; hechos confirmados protegidos; seguimiento por adición; solicitud justificada, decisión independiente, sin autoaprobación ni eliminación física; protección de información sensible desde el backend.
- **Propuesta recomendada:** alcances I/P/R de la matriz, criterios de revisión, mínimos de confidencialidad, campos O/C/opcionales y condiciones de cierre/reapertura descritos abajo. Su consolidación no los convierte en procedimientos del colegio.
- **Validación del Director o Subdirector:** decisiones de la sección 5. La autoridad que valide un procedimiento no queda habilitada para resolver un caso en el que tenga conflicto. El esquema técnico existe; no implica aprobación de los procedimientos institucionales pendientes.

## 1. Matriz de permisos

Matriz de acceso para desarrollo, incluida la ampliación del 20 de noviembre. La aprobación que exige revisión formal sigue bloqueada hasta definir composición y quórum. Producción requiere validación institucional. D: Director; SD: Subdirector; CT: Coordinador de Tutoría; DO: Docente; AU: Auxiliar; AD: Administrador.

- **I**: expedientes internos, con permiso para la acción. **P**: solo internos cuyo registrador sea el usuario; no basta ser reportante o participante.
- **R**: expedientes restringidos, además de internos. **B**: únicamente borradores propios. **S**: acción permitida bajo las condiciones indicadas. **—**: denegada.
- Toda concesión exige sesión activa, estado compatible y ausencia de impedimento para gestionar el caso. La restricción más fuerte prevalece; el rol por sí solo no habilita todas las acciones.

| Acción | D | SD | CT | DO | AU | AD |
| --- | --- | --- | --- | --- | --- | --- |
| Crear y confirmar una incidencia | S | S | S | S | S | — |
| Consultar/editar borrador propio | B | B | B | B | B | — |
| Consultar expediente confirmado e historial del caso | R | R | I | P | P | — |
| Registrar actuaciones u observaciones | R | R | I | P | P | — |
| Cambiar prioridad o elevar confidencialidad | R | R | I | P | P | — |
| Cerrar o reabrir caso con motivo | R | R | I | — | — | — |
| Solicitar rectificación o anulación | R | R | I | P | P | — |
| Evaluar exigencia de revisión formal | R | R | — | — | — | — |
| Revisar solicitud y emitir conclusión, sin decidir | R | R | I | — | — | — |
| Aprobar o rechazar solicitud | R | R | — | — | — | — |
| Anular lógicamente como efecto de aprobación | R | R | — | — | — | — |
| Generar PDF del contenido autorizado | R | R | I | P | P | — |
| Gestionar estudiantes, matrículas y apoderados con reautenticación en escrituras | S | S | S | — | — | — |
| Autorizar gestión de cuentas/cambios sensibles de permisos | S | S | — | — | — | — |
| Ejecutar administración de cuentas y permisos autorizados | S | S | — | — | — | S |

**Límites obligatorios:** ninguna función edita directamente hechos confirmados ni elimina físicamente expedientes. «Anular» no es un botón fuera del flujo: la misma transacción que aprueba una solicitud de anulación aplica el cambio de estado. Revisar no es aprobar; el solicitante no revisa formalmente ni resuelve su propia petición. Director y Subdirector son las máximas autoridades, con las mismas restricciones de independencia.

**Privacidad:** interna no significa pública. Docente/Auxiliar no pueden consultar otros expedientes por conocer su ID. CT puede gestionar internos; acceso a restringidos propuesto solo para D/SD. Todos los roles operativos pueden capturar y confirmar un reporte sensible, pero la confirmación no les concede acceso posterior: a quien carezca de permiso se devuelve solo constancia de recepción e identificador, sin expediente ni PDF. Si después necesita aportar datos, los comunica a una autoridad habilitada, que registra la actuación o solicitud con su propia autoría; no se suplanta al informante. Revisar este procedimiento antes de aprobar la matriz.

Salud y Protección estudiantil se clasifican como restringidas por defecto; cualquier otra categoría también puede serlo por su contenido. Aplicar el mismo límite a versiones, actuaciones, solicitudes, actas, búsquedas, contadores y PDF. Exportar requiere permiso separado y registro en historial; no exportar borradores, datos ajenos al alcance ni documentos completos a partir de fragmentos autorizados. Bajar confidencialidad requiere solicitud y aprobación independiente, y no puede eludir el mínimo aprobado para la categoría. No se permiten excepciones individuales de lectura implícitas por ser participante.

**Administración:** AD no consulta ni modifica expedientes, no genera sus PDF y no puede concederse permisos de incidencias ni cambiar su propio rol. D/SD autorizan cambios de cuentas y permisos; la ejecución respeta los permisos efectivos de AD/D/SD y la independencia respecto de los decisores. No pueden autorizar cambios sensibles sobre su propia cuenta. La autorización y ejecución se auditan con sus actores y destinos; deben corresponder al mismo cambio concreto. El historial es evidencia, no un mecanismo para ejecutar instrucciones. El flujo de aprobación de cuentas implementado en desarrollo es el descrito al inicio; su habilitación institucional sigue pendiente.

Administrar cuentas permite únicamente consultar la identidad del personal necesaria para identificar la cuenta y ejecutar el cambio autorizado; no habilita búsquedas de estudiantes, apoderados, reportantes ni lectura del historial de expedientes. La gestión de catálogos escolares y tipos sigue sin asignación aprobada; no se incluye implícitamente en administración de usuarios. Los reportes, listados y PDF respetan el mismo alcance de lectura, con permiso de exportación separado.

## 2. Tres niveles de modificación

| Nivel | Regla funcional | Evidencia conservada |
| --- | --- | --- |
| Borrador | Autor corrige antes de confirmar; vista previa y confirmación explícita. Sin autoguardado. El guardado exige los campos comunes obligatorios del modelo. | Cada edición guardada añade una versión y conserva los participantes anteriores, sin eliminarlos. |
| Seguimiento | Agregar actuaciones/observaciones, prioridad o estado operativo con permiso. Corregir una actuación mediante otra enlazada y justificada. | Hechos originales intactos; autor, rol, fechas e historial de cada operación. |
| Rectificación/anulación | Solicitud justificada con versión base; autoridad independiente aprueba o rechaza. Cambiar hechos incluye descripción, tipo, reportante, estudiantes, fecha o gravedad. | Propuesta y versión anterior, resolución, revisiones y actas cuando correspondan; anulación solo lógica. |

Cerrar exige una actuación de conclusión, motivo y ausencia de solicitudes pendientes; no equivale a anular. Reabrir exige motivo y permiso; no restaura una incidencia anulada. Las actuaciones pendientes se revisan antes del cierre, sin crear un sistema adicional de tareas.

Después de confirmar, incluso una errata en los hechos pasa por solicitud; su menor impacto puede simplificar la revisión, nunca permitir edición directa. Una modificación crítica es una rectificación o anulación sometida a controles adicionales, no un tercer tipo de solicitud ni una tabla nueva. Los criterios del punto 3 son recomendaciones sujetas a validación; mientras no se acuerden, no se presume exención de revisión o acta.

### Solicitud y resolución

1. Solicitante identifica el cambio, justificación y versión base. Rectificación propone una versión completa con involucrados o un cambio de confidencialidad. Anulación indica motivo; si es duplicado, referencia otro expediente que permanece, sin fusionar ni borrar datos.
2. Una autoridad D/SD independiente evalúa si requiere revisión formal; el CT puede realizar la revisión de un interno y emitir conclusión, pero no aprobar ni reducir las exigencias establecidas. El solicitante no determina unilateralmente que su propia petición queda exenta de revisión.
3. Propuesta de criterios: un error material que no cambia identidad, hechos, clasificación o responsabilidades admite revisión documental sin reunión. Cambiar participantes, atribución de hechos, gravedad, contenido sensible, anular por hechos controvertidos o reducir confidencialidad exige revisión formal, reunión y acta. Un duplicado claramente comprobado puede resolverse documentalmente. Estas distinciones requieren aprobación del colegio; ante duda se mantiene pendiente, no se omiten controles.
4. Cuando corresponda, registrar participantes por persona, funciones, asistencia, conclusión y acta. Validar composición y quórum aprobados antes de resolver; si no están definidos, no dar la revisión por suficiente. Reunión y acta no son obligatorias para todas las incidencias ni sustituyen la decisión independiente. Actas emitidas y revisiones concluidas no se sobrescriben; corrección mediante revisión complementaria enlazada.
5. Decisor debe ser competente, diferente del solicitante y sin conflicto pendiente/inhibición, comprobado por usuario y persona, aunque haya cambiado de rol. Un evaluador independiente puede ser también el decisor; no se exige una tercera autoridad. Registrar fundamento y fecha del servidor.
6. Bloquear la incidencia y revalidar versión base, permisos, revisión y conflictos en la transacción. Solo una solicitud pendiente por caso. Una propuesta obsoleta requiere reevaluación. Aplicar resolución, versión vigente/estado e historial atómicamente; conservar incluso propuestas rechazadas o retiradas.

Una autoridad con conflicto no gestiona, revisa ni decide el caso; puede declarar su inhibición y aportar información como parte por el canal institucional, sin ejercer autoridad. No puede descartar su propio conflicto. Si el Director solicita, resuelve el Subdirector solo si está habilitado y es independiente, y viceversa. **Si ambos están impedidos, se bloquea la decisión, la solicitud queda pendiente y se registra el motivo; el escalamiento institucional sigue por definir.** AD no actúa como sustituto.

### Evidencia de cada etapa

| Etapa | Actor, instante, motivo y resultado conservados |
| --- | --- |
| Solicitud | solicitudes_cambio: id_solicitante/id_rol_solicitante, creada_en, justificacion, tipo, estado y versión base/propuesta. |
| Evaluación independiente | id_evaluador, evaluada_en, fundamento_revision y requiere_revision; los cuatro NULL hasta evaluar, luego completos juntos. Historial conserva actor/rol, cambios y reevaluaciones. |
| Revisión formal | revisiones: id_responsable, abierta_en/cerrada_en, motivo, conclusion y estado; participantes_revision identifica personas y funciones. Reunión/acta solo según exigencias aprobadas. Historial identifica quién abre, concluye y emite el acta. |
| Resolución | id_decisor/id_rol_decisor, decidida_en, fundamento_decision y estado aprobada/rechazada; efecto sobre versión o anulación e historial en una transacción. |

Revisor responsable, evaluador y decisor deben ser independientes del solicitante y sin impedimento; no se exige que sean tres personas diferentes. Conservar rol ejercido mediante historial donde no haya columna histórica específica. Las fechas de registro, evaluación y decisión las fija el servidor; la fecha declarada de una actuación no reemplaza su fecha de registro.

### Confidencialidad por contenido

Propuesta de clasificación mínima, a validar por D/SD. La categoría orienta, pero nunca rebaja la protección necesaria por el contenido:

| Caso | Nivel recomendado y alcance |
| --- | --- |
| Salud y Protección estudiantil | Restringida desde captura, incluidas versiones y seguimiento. |
| Testigo confidencial, presunta violencia o vulneración de derechos, en cualquier categoría | Restringir todo el expediente; no basta ocultar el nombre en una pantalla o PDF. No se presume responsabilidad por esta clasificación. |
| Convivencia, Disciplina, Seguridad o Bienes sin contenido sensible | Interna según matriz, nunca lectura general para todo el personal. Elevar a restringida si aparecen datos sensibles. |

El modelo aplica confidencialidad al expediente completo. Un estudiante testigo se relaciona en involucrados con participacion=testigo y su identidad queda bajo esa protección. No se promete anonimato frente a las autoridades autorizadas ni acceso parcial por campo. Los datos de personas enlazadas tampoco pueden obtenerse por rutas de catálogo para eludir la restricción del expediente.

El backend comprueba sesión, acción, alcance, estado y conflictos en cada lectura o escritura; filtra también consultas por ID, búsquedas, contadores, historial y exportaciones. Valida la sensibilidad al confirmar, agregar actuaciones y proponer cambios; si el nuevo contenido exige mayor protección, la eleva en la misma transacción antes de exponerlo. La recepción de un reporte sensible por un registrador sin acceso posterior sigue pendiente de aprobación como procedimiento institucional; no concede lectura por haberlo creado.

Bajar confidencialidad exige solicitud y decisión independiente y debe considerar **todas las versiones, actuaciones y actas conservadas**, no solo la versión vigente. Si el historial contiene un testigo confidencial o información sensible, no bajar el nivel del expediente completo. Ejemplo: quitar un nombre de la versión nueva no autoriza exponer la versión anterior. No registrar datos sensibles innecesarios en títulos, mensajes de error o constancias. El backend aplica los controles de lectura y seguimiento; la reducción de confidencialidad por solicitud sigue pendiente de implementación.

## 3. Formularios dinámicos

### Campos generales

| Grupo | Campos y validación al confirmar |
| --- | --- |
| Automáticos | Usuario, nombre histórico y rol del registrador; fecha/hora de registro y confirmación del servidor. No editables ni aceptados como autoridad desde el cliente. |
| Hecho | Tipo obligatorio, categoría derivada del tipo, título y descripción obligatorios. Ocurrencia y lugar cuando se conocen; no inventar datos si se desconocen. Prioridad obligatoria: baja/normal/alta/urgente, independiente de gravedad disciplinaria. |
| Reportante | Una persona obligatoria, condición personal/estudiante/apoderado/externo y nombre histórico. Puede coincidir con el registrador, pero se selecciona y valida separadamente. Un externo o personal sin cuenta no necesita usuario. |
| Estudiantes | Cero o más filas de involucrados según tipo, sin repetidos; participación principal y matrícula histórica si se conoce. Un desmayo de estudiante exige al menos uno; riesgo eléctrico sin afectados permite cero. No exigir dos en todos los casos ni inventar estudiantes. |
| Identidad y protección | DNI no obligatorio: documento alternativo o código interno provisional validado. Confidencialidad obligatoria, con mínimo por categoría y revisión del contenido sensible. Datos personales limitados a los necesarios. |

Etiquetas de interfaz más descriptivas **no crean categorías adicionales**. Se mantienen los seis códigos de DISENO.md. O: obligatorio al confirmar; C: obligatorio si se cumple la condición; opcional: puede quedar NULL. Los booleanos obligatorios requieren respuesta sí/no, sin asumir «no» por defecto.

| Categoría visible (código) | Campos específicos propuestos | Estudiantes y protección |
| --- | --- | --- |
| Convivencia escolar (`convivencia`) | O: `ambito_convivencia` presencial/digital/mixto, `requiere_mediacion`. Descripción distingue observación de información reportada. | Mínimo por tipo, no por categoría; no presumir culpa. Restringir si contiene violencia o información sensible. |
| Disciplina (`disciplina`) | O: `gravedad_disciplinaria`, admitiendo `por_evaluar`; C: `norma_referida` cuando se conoce la norma aplicable. No inventar norma ni sanción. | Mínimo por tipo; gravedad propuesta no equivale a responsabilidad acreditada. |
| Salud y bienestar (`salud`) | O: `sintomas_observados`, `requiere_atencion_inmediata`. No exigir diagnóstico; atención realizada se agrega en actuaciones. | Desmayo de estudiante: mínimo uno. Hecho relativo a personal: puede ser cero. Restringida; gravedad disciplinaria NULL. |
| Accidentes y seguridad (`seguridad`) | O: `riesgo_identificado`, `riesgo_persistente`; descripción relata accidente o peligro. Acciones inmediatas en actuaciones. | Riesgo sin afectados: cero; accidente de estudiante identificado: al menos uno. Gravedad disciplinaria NULL para accidentes fortuitos; no clasificar automáticamente como falta. |
| Bienes y pertenencias (`bienes`) | O: `descripcion_dano` (incluye pérdida/afectación); opcional: `monto_estimado` no negativo; C: `moneda` si existe importe. | Cero si no se identifican estudiantes; no inventar responsable. Estimación global, no inventario individualizado. |
| Protección estudiantil (`proteccion_estudiantil`) | O: `riesgo_inmediato`, `requiere_derivacion`; descripción factual mínima, sin detalles íntimos innecesarios. Actuaciones para medidas posteriores. | Tipo de amenaza general permite cero; caso individual con estudiante identificado exige uno o más. Restringida; no exigir gravedad disciplinaria. |

El backend valida cada campo según el tipo y rechaza campos de otras categorías; no basta ocultarlos en pantalla. Los mínimos por tipo se configuran antes de usarlo; no se cambian para reinterpretar casos históricos. En datos desconocidos no se exige texto ficticio: si un tipo no permite confirmar sin identidad de estudiante, se debe acordar un tipo de alerta general, no fabricar una persona.

En los campos generales, son obligatorios al confirmar tipo, título, descripción, prioridad, confidencialidad y reportante con condición e identidad histórica; autoría y fechas automáticas también son obligatorias. Ocurrencia y lugar pueden quedar NULL si se desconocen. Estudiante y participación son obligatorios en cada fila de involucrados, pero el conjunto puede estar vacío si el tipo lo admite; matrícula es condicional cuando se conoce. Documento, teléfono y correo no se vuelven obligatorios por registrar un hecho. No asumir respuestas booleanas ni inventar síntomas o riesgos: si los mínimos del formulario no describen un caso real, validar el tipo/formulario con la institución antes de usarlo.

## 4. Cobertura del esquema vigente

| Regla | Cobertura |
| --- | --- |
| Matriz y alcance interno/propio/restringido | roles, usuarios, permisos y roles_permisos; alcance propio derivado de incidencias.id_registrador, confidencialidad del expediente. No necesita ACL por caso ni tablas nuevas. Prohibiciones y filtros se ejecutan en backend. |
| Identidad, externos, extranjeros, apoderados y contexto escolar | personas, estudiantes, estudiantes_apoderados, aulas y matriculas cubren relaciones e identificación alternativa; no duplicar personas ni convertir reportantes en cuentas. |
| Seis formularios, cero o varios estudiantes y versiones | tipos_incidencia, incidencias, versiones_incidencia e involucrados ya contienen los campos propuestos. Las etiquetas visibles no cambian códigos; ajustar obligatoriedad condicional en backend, manteniendo NULL para campos de otras categorías. |
| Seguimiento, cierre y corrección de actuaciones | actuaciones e historial cubren conclusión, cambios operativos y correcciones enlazadas. No requiere columna extra para cada estado ni tabla de cierre. |
| Rectificación, anulación y autoría de su evaluación | solicitudes_cambio conserva propuesta, evaluación independiente y decisión. id_evaluador referencia usuarios y evaluada_en usa DATETIME2(6); se completan juntos al evaluar. Reevaluaciones auditadas; decisión documental implementada y aprobación formal bloqueada. |
| Reunión requerida frente a reunión celebrada | revisiones conserva requiere_reunion y hubo_reunion como TINYINT con CHECK booleano, reunion_en, motivo y acta. Representar estos datos no habilita la aprobación formal sin composición y quórum. |
| Participantes, actas, conflictos y doble impedimento | revisiones, participantes_revision, conflictos_interes e historial cubren reunión y bloqueo. No falta relación para estos casos; criterios institucionales no los resuelve una tabla nueva. |
| Auditoría y PDF | historial registra consultas sensibles, cambios y exportaciones. PDFKit genera informes autorizados con identidad histórica, sin tabla de reportes ni archivos permanentes. |
| Autorizaciones administrativas | autorizaciones_cuentas conserva cambio exacto, objetivo, solicitante, decisiones independientes, vencimiento y ejecución única. historial añade evidencia sin contraseñas ni instrucciones ejecutables. |
| Autenticación | sesiones e intentos_acceso conservan tokens resumidos, límites de acceso y vencimientos. Completan las 22 tablas junto con las 19 escolares y autorizaciones_cuentas. |

**Relaciones vigentes:** `involucrados.id_persona` permite estudiantes y testigos adultos; solo los estudiantes pueden tener matrícula. Se mantienen las FK compuestas de versión, solicitud y revisión. La confidencialidad cubre el expediente completo; ocultar un testigo a quien ve el resto del caso requeriría diseñar acceso parcial, que sigue fuera del alcance. No se usan participantes_revision ni texto narrativo para sustituir relaciones de testigos.

## 5. Decisiones pendientes

1. Aprobar la matriz: alcance de CT, límites de DO/AU, acceso restringido solo D/SD, PDF y recepción de reportes sensibles sin acceso posterior del registrador.
2. Aprobar criterios de revisión documental frente a reunión/acta, composición, quórum, subsanaciones, cierre/reapertura e independencia. Definir escalamiento cuando ambas autoridades estén impedidas; hasta entonces, bloquear.
3. Aprobar formularios, tipos/mínimos, campos obligatorios y protección mínima para Salud y Protección estudiantil. Acordar identificación provisional y alertas sin estudiantes identificados.
4. Validar institucionalmente el flujo de cuentas/permisos implementado en desarrollo y definir la resolución de desacuerdos.
5. Confirmar límites de alcance, conservación de datos, auditoría y respaldos. Estas reglas y el modelo siguen siendo propuestas; la revisión documental no sustituye aprobación humana ni verificación técnica en SQL Server.
6. Validar protección de testigos y presunta violencia en cualquier categoría, protección del historial al reducir confidencialidad y los límites del acceso parcial. Los testigos adultos ya están relacionados mediante personas. Acordar además permisos de gestión de catálogos escolares y tipos; AD solo administra cuentas/permisos.
