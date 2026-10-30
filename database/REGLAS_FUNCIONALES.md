# SICE-Local: reglas funcionales propuestas

Fase 2.2 · 30 de octubre de 2026 · **Pendiente de aprobación institucional**.

Institución: I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete.

Complementa [DISENO.md](DISENO.md), sin modificarlo ni declarar aprobado el modelo. Se mantienen las 19 tablas; se proponen ajustes puntuales de columnas. No se implementan SQL, JavaScript ni autoguardado.

## 1. Matriz de permisos

Propuesta inicial, no autorización vigente. D: Director; SD: Subdirector; CT: Coordinador de Tutoría; DO: Docente; AU: Auxiliar; AD: Administrador.

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
| Revisar solicitud y emitir conclusión, sin decidir | R | R | I | — | — | — |
| Aprobar o rechazar solicitud | R | R | — | — | — | — |
| Anular lógicamente como efecto de aprobación | R | R | — | — | — | — |
| Generar PDF del contenido autorizado | R | R | I | P | P | — |
| Autorizar gestión de cuentas/cambios sensibles de permisos | S | S | — | — | — | — |
| Ejecutar administración de cuentas y permisos autorizados | — | — | — | — | — | S |

**Límites obligatorios:** ninguna función edita directamente hechos confirmados ni elimina físicamente expedientes. «Anular» no es un botón fuera del flujo: la misma transacción que aprueba una solicitud de anulación aplica el cambio de estado. Revisar no es aprobar; el solicitante no revisa formalmente ni resuelve su propia petición. Director y Subdirector son las máximas autoridades, con las mismas restricciones de independencia.

**Privacidad:** interna no significa pública. Docente/Auxiliar no pueden consultar otros expedientes por conocer su ID. CT puede gestionar internos; acceso a restringidos propuesto solo para D/SD. Todos los roles operativos pueden capturar y confirmar un reporte sensible, pero la confirmación no les concede acceso posterior: a quien carezca de permiso se devuelve solo constancia de recepción e identificador, sin expediente ni PDF. Si después necesita aportar datos, los comunica a una autoridad habilitada, que registra la actuación o solicitud con su propia autoría; no se suplanta al informante. Revisar este procedimiento antes de aprobar la matriz.

Salud y Protección estudiantil se clasifican como restringidas por defecto; cualquier otra categoría también puede serlo por su contenido. Aplicar el mismo límite a versiones, actuaciones, solicitudes, actas, búsquedas, contadores y PDF. Exportar requiere permiso separado y registro en historial; no exportar borradores, datos ajenos al alcance ni documentos completos a partir de fragmentos autorizados. Bajar confidencialidad requiere solicitud y aprobación independiente, y no puede eludir el mínimo aprobado para la categoría. No se permiten excepciones individuales de lectura implícitas por ser participante.

**Administración:** AD no consulta ni modifica expedientes, no genera sus PDF y no puede concederse permisos de incidencias ni cambiar su propio rol. D/SD autorizan cambios de cuentas y permisos; AD los ejecuta dentro de límites no delegables. No pueden autorizar cambios sensibles sobre su propia cuenta. La autorización y ejecución se auditan con sus actores y destinos; deben corresponder al mismo cambio concreto. El historial es evidencia, no un mecanismo para ejecutar instrucciones. El procedimiento de autorización institucional debe acordarse antes de habilitar cambios sensibles; no se supone ya implementado un flujo de aprobación de cuentas.

## 2. Tres niveles de modificación

| Nivel | Regla funcional | Evidencia conservada |
| --- | --- | --- |
| Borrador | Autor corrige antes de confirmar; vista previa y confirmación explícita. Sin autoguardado. Si se ofrece guardado manual, exige los campos comunes obligatorios del modelo. | Identidad de registrador y borrador; no se exige una versión por cada cambio de formulario. |
| Seguimiento | Agregar actuaciones/observaciones, prioridad o estado operativo con permiso. Corregir una actuación mediante otra enlazada y justificada. | Hechos originales intactos; autor, rol, fechas e historial de cada operación. |
| Rectificación/anulación | Solicitud justificada con versión base; autoridad independiente aprueba o rechaza. Cambiar hechos incluye descripción, tipo, reportante, estudiantes, fecha o gravedad. | Propuesta y versión anterior, resolución, revisiones y actas cuando correspondan; anulación solo lógica. |

Cerrar exige una actuación de conclusión, motivo y ausencia de solicitudes pendientes; no equivale a anular. Reabrir exige motivo y permiso; no restaura una incidencia anulada. Las actuaciones pendientes se revisan antes del cierre, sin crear un sistema adicional de tareas.

### Solicitud y resolución

1. Solicitante identifica el cambio, justificación y versión base. Rectificación propone una versión completa con involucrados o un cambio de confidencialidad. Anulación indica motivo; si es duplicado, referencia otro expediente que permanece, sin fusionar ni borrar datos.
2. Una autoridad D/SD independiente evalúa si requiere revisión formal; el CT puede realizar la revisión de un interno y emitir conclusión, pero no aprobar ni reducir las exigencias establecidas. El solicitante no determina unilateralmente que su propia petición queda exenta de revisión.
3. Propuesta de criterios: un error material que no cambia identidad, hechos, clasificación o responsabilidades admite revisión documental sin reunión. Cambiar participantes, atribución de hechos, gravedad, contenido sensible, anular por hechos controvertidos o reducir confidencialidad exige revisión formal, reunión y acta. Un duplicado claramente comprobado puede resolverse documentalmente. Estas distinciones requieren aprobación del colegio; ante duda se mantiene pendiente, no se omiten controles.
4. Cuando corresponda, registrar participantes por persona, funciones, asistencia, conclusión y acta. Validar composición y quórum aprobados antes de resolver; si no están definidos, no dar la revisión por suficiente. Reunión y acta no son obligatorias para todas las incidencias ni sustituyen la decisión independiente. Actas emitidas y revisiones concluidas no se sobrescriben; corrección mediante revisión complementaria enlazada.
5. Decisor debe ser competente, diferente del solicitante y sin conflicto pendiente/inhibición, comprobado por usuario y persona, aunque haya cambiado de rol. Un evaluador independiente puede ser también el decisor; no se exige una tercera autoridad. Registrar fundamento y fecha del servidor.
6. Bloquear la incidencia y revalidar versión base, permisos, revisión y conflictos en la transacción. Solo una solicitud pendiente por caso. Una propuesta obsoleta requiere reevaluación. Aplicar resolución, versión vigente/estado e historial atómicamente; conservar incluso propuestas rechazadas o retiradas.

Una autoridad con conflicto no gestiona, revisa ni decide el caso; puede declarar su inhibición y aportar información como parte por el canal institucional, sin ejercer autoridad. No puede descartar su propio conflicto. Si el Director solicita, resuelve el Subdirector solo si está habilitado y es independiente, y viceversa. **Si ambos están impedidos, se bloquea la decisión, la solicitud queda pendiente y se registra el motivo; el escalamiento institucional sigue por definir.** AD no actúa como sustituto.

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

## 4. Contraste con las 19 tablas

| Regla | Cobertura y ajuste propuesto |
| --- | --- |
| Matriz y alcance interno/propio/restringido | roles, usuarios, permisos y roles_permisos; alcance propio derivado de incidencias.id_registrador, confidencialidad del expediente. No necesita ACL por caso ni tablas nuevas. Prohibiciones y filtros se ejecutan en backend. |
| Identidad, externos, extranjeros, apoderados y contexto escolar | personas, estudiantes, estudiantes_apoderados, aulas y matriculas cubren relaciones e identificación alternativa; no duplicar personas ni convertir reportantes en cuentas. |
| Seis formularios, cero o varios estudiantes y versiones | tipos_incidencia, incidencias, versiones_incidencia e involucrados ya contienen los campos propuestos. Las etiquetas visibles no cambian códigos; ajustar obligatoriedad condicional en backend, manteniendo NULL para campos de otras categorías. |
| Seguimiento, cierre y corrección de actuaciones | actuaciones e historial cubren conclusión, cambios operativos y correcciones enlazadas. No requiere columna extra para cada estado ni tabla de cierre. |
| Rectificación, anulación y autoría de su evaluación | solicitudes_cambio cubre propuesta y decisión. **Proponer `id_evaluador FK usuarios NULL` y `evaluada_en DATETIME(6) NULL`**, completos juntos al evaluar; independiente del solicitante. Conserva quién fijó requiere_revision/fundamento_revision, sin confundirlo con la decisión final. Reevaluaciones se auditan. |
| Reunión requerida frente a reunión celebrada | revisiones contiene hubo_reunion/reunion_en, pero no la exigencia previa. **Proponer `requiere_reunion BOOLEAN`**, distinto de hubo_reunion; fundamento en motivo. Si se exige, impedir concluir sin reunión. Acta requerida y emitida ya están representadas. |
| Participantes, actas, conflictos y doble impedimento | revisiones, participantes_revision, conflictos_interes e historial cubren reunión y bloqueo. No falta relación para estos casos; criterios institucionales no los resuelve una tabla nueva. |
| Auditoría y PDF | historial registra consultas sensibles, cambios y exportaciones; PDF se genera a partir de datos autorizados, sin tabla de reportes. No se desarrolla todavía. |
| Autorizaciones administrativas | Actores/destinos y eventos de autorización/ejecución caben en historial para el alcance de evidencia. Si se exige un flujo informático de solicitudes administrativas con estados y aprobación vinculante, **no está modelado**: debe diseñarse explícitamente, sin reutilizar solicitudes de expedientes ni esconder instrucciones en texto. No se añade automáticamente. |

**Resultado:** las reglas propuestas son compatibles con las 19 tablas y tres columnas adicionales, sujetas a revisión. Las nuevas columnas solo se proponen aquí; DISENO.md no se altera en esta tarea. Mantener FK compuestas de versión/solicitud/revisión y validación de matrícula; no se requiere cambiar esas relaciones. Antes del SQL, incorporar los ajustes que se aprueben y revalidar los dominios y nulabilidad.

No se detecta otra necesidad estructural para este alcance. Acceso individual por expediente, votaciones/firmas, varios reportantes, inventario o un flujo administrativo automatizado sí ampliarían el alcance y no están resueltos con texto libre. Confirmar que no se necesitan antes de aprobar el esquema. No se promete ausencia de cambios ante nuevos requisitos.

## 5. Decisiones pendientes

1. Aprobar la matriz: alcance de CT, límites de DO/AU, acceso restringido solo D/SD, PDF y recepción de reportes sensibles sin acceso posterior del registrador.
2. Aprobar criterios de revisión documental frente a reunión/acta, composición, quórum, subsanaciones, cierre/reapertura e independencia. Definir escalamiento cuando ambas autoridades estén impedidas; hasta entonces, bloquear.
3. Aprobar formularios, tipos/mínimos, campos obligatorios y protección mínima para Salud y Protección estudiantil. Acordar identificación provisional y alertas sin estudiantes identificados.
4. Aprobar las tres columnas propuestas y el procedimiento de autorización de cuentas/permisos; aclarar si se requiere un flujo administrativo automatizado adicional.
5. Confirmar límites de alcance, conservación de datos, auditoría y respaldos. Estas reglas y el modelo siguen siendo propuestas; la revisión documental no sustituye aprobación humana ni pruebas de MySQL.
