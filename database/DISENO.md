# SICE-Local: modelo relacional vigente

Esquema técnico para desarrollo con MariaDB 10.11.16 de XAMPP: **22 tablas, 225 columnas, 76 claves foráneas y 51 CHECK**. La validación técnica no sustituye aprobación institucional para producción. La definición exacta de columnas, índices y restricciones está en [schema.sql](schema.sql); este documento explica sus responsabilidades sin duplicar el DDL.

## Tablas y responsabilidades

| Tablas | Función y relaciones |
| --- | --- |
| personas | Identidad común de personal, estudiantes, apoderados y externos; no obliga a tener cuenta ni documento conocido. |
| roles, usuarios, permisos, roles_permisos | Seis roles, una cuenta vinculada a persona y un rol vigente, permisos por rol. La jerarquía no depende del identificador. |
| estudiantes | Perfil estudiantil de una persona; no crea una segunda identidad. |
| estudiantes_apoderados | Múltiples apoderados por estudiante y vigencia del vínculo; un apoderado puede representar a varios estudiantes. |
| aulas, matriculas | Grupo por año/nivel/grado/sección y pertenencia histórica del estudiante. |
| tipos_incidencia | Categoría y mínimo estudiantil; sin tabla por formulario ni catálogos redundantes para dominios cerrados. |
| incidencias | Expediente, autoría, prioridad, confidencialidad, estado y versión vigente. |
| versiones_incidencia | Hechos, tipo, reportante y campos por categoría; preserva propuestas e historia. |
| involucrados | Personas relacionadas con una versión, incluidos testigos adultos. Solo estudiantes pueden tener matrícula, que debe pertenecerles. |
| actuaciones | Seguimiento por adición y correcciones enlazadas; conserva autor, responsable y fechas. |
| solicitudes_cambio | Base y propuesta, evaluación y resolución independientes de rectificación/anulación. Resolución documental implementada; aprobación con acta bloqueada hasta definir composición y quórum. |
| revisiones, participantes_revision | Revisión formal, reunión/acta y personas participantes; no sustituye las relaciones de testigos. |
| conflictos_interes | Impedimentos, inhibición y eventual resolución independiente. |
| historial | Evidencia de actores, roles, fechas, motivos y cambios; no es un motor de ejecución. |
| sesiones, intentos_acceso | Tokens resumidos y límites de acceso con vencimiento; no contraseñas ni cookies en claro. |
| autorizaciones_cuentas | Solicitudes, objetivos, decisiones separadas de D/SD, vigencia y ejecución única. Incluye el flujo actual desde su creación. |

## Decisiones que deben conservarse

- InnoDB y utf8mb4_unicode_ci; identificadores descriptivos en español y snake_case. PK y FK con tipos compatibles, relaciones compuestas para evitar referencias entre expedientes distintos y restricciones de dominios/booleanos.
- Documento, teléfono y correo son texto. País/tipo/número de documento se completan juntos o quedan NULL. Código interno para identidad provisional con verificación humana; no inventar DNI ni fusionar identidades automáticamente.
- Una persona puede ser personal y apoderada; desactivar su cuenta no elimina identidad ni autoría. Los nombres y roles históricos se conservan expresamente en documentos, aunque cambien datos actuales.
- DATE para fechas civiles y DATETIME(6) UTC para instantes; presentación en America/Lima. Ocurrencia declarada y registro del servidor no son intercambiables.
- Categoría, prioridad y gravedad no son equivalentes. Salud no es falta disciplinaria; los campos ajenos a la categoría quedan NULL. Cero, uno o varios estudiantes según el tipo, sin inventar participantes.
- El reportante puede ser externo y distinto del registrador. Testigos adultos se relacionan mediante personas y no necesitan matrícula ni participación ficticia en una reunión.
- Confidencialidad por expediente completo, con versiones, actuaciones y actas. No existe acceso parcial por testigo ni permiso de lectura por participar en un caso.
- Borradores propios editables; hechos confirmados conservados. Correcciones por versiones o actuaciones enlazadas, anulación lógica y auditoría. FK/RESTRICT no sustituyen autorización ni garantizan por sí solas inmutabilidad.
- Los ciclos incidencia/versión y solicitud/revisión se completan con FK al final del DDL; las operaciones del backend cierran sus referencias en transacciones sin desactivar integridad.
- Autoridades competentes e independientes por persona y cuenta. Si ambas están impedidas, bloquear; el Administrador no las sustituye. Sin excepción automática ni desbloqueo unilateral del desacuerdo.
- Una solicitud de cuenta conserva valores exactos, huella, vencimiento, decisores y ejecutor; no guarda contraseñas ni interpreta el historial como instrucciones. Estados legado permiten conservar autorizaciones antiguas, sin migrarlas automáticamente.

## Instalación y límites

El esquema completo se ejecuta solo sobre una base vacía. `preparar.js` valida las 19 tablas escolares y crea exclusivamente tablas técnicas faltantes; nunca modifica las existentes ni carga datos. Las instrucciones y privilegios están en [README.md](../README.md).

La ampliación de expedientes y creación de estudiantes reutiliza las 22 tablas sin modificar el esquema. Ediciones de borrador y propuestas añaden versiones/participantes, cierre y reapertura añaden actuaciones e historial y las decisiones se guardan en solicitudes_cambio. Las sesiones y cuentas se revalidan dentro de las transacciones.

La matriz de permisos, condiciones de formularios, requisitos de revisión y decisiones institucionales pendientes se mantienen en [REGLAS_FUNCIONALES.md](REGLAS_FUNCIONALES.md). Quedan fuera del alcance actual acceso parcial, adjuntos, múltiples reportantes por versión, votaciones o firmas electrónicas, inventario y seguimiento clínico; requerirían requisitos y diseño propios. No se añaden tablas anticipadamente ni se fuerza un número fijo ante nuevos requisitos aprobados.
