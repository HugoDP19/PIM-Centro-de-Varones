# Contexto de SICE-Local

## Estado vigente — 24 de noviembre de 2026

Proyecto de la I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete. Los estudiantes son varones; personal y reportantes pueden ser hombres o mujeres. Conservar el logo original de image/, el diseño blanco y guinda y la interfaz responsive.

Rama: `feature/incidencias-informes`. Repositorio: https://github.com/HugoDP19/PIM-Centro-de-Varones.git. Alcance actual: correcciones de auditoría, estabilidad, pruebas finales y commits locales separados; sin push ni Pull Request. No ampliar funcionalidades ni modificar registros de SICE durante esta revisión.

## Motor y datos

- Aplicación exclusivamente con SQL Server 2022 y mssql. Instancia local verificada: Developer 16.0.1000.6, MSSQLSERVER, 127.0.0.1:1433; SSMS 22.
- Migración terminada: identificadores, contraseñas derivadas, relaciones, versiones e historial conservados y comparados. Las bases anteriores permanecen independientes e intactas; no se eliminan.
- SICE conserva 22 tablas, 225 columnas, 76 FK y 148 CHECK activos y confiables. NVARCHAR/Latin1_General_100_CI_AI_SC, DATETIME2(6) UTC, identificadores BIGINT positivos hasta 9223372036854775807 e índices únicos filtrados para datos opcionales.
- Seis cuentas activas, tres estudiantes y seis borradores sintéticos, uno por categoría. No hay 26 expedientes en esta instalación y no deben inventarse. Los borradores requieren completar campos y confirmar antes del PDF.
- Conexión y claves en archivos privados ignorados por Git. Cuenta SQL limitada a SICE: SELECT/INSERT, UPDATE salvo historial, DELETE solo en sesiones/intentos_acceso/roles_permisos. Sin DDL ni administración.
- No cargar datos al iniciar. Los fixtures de test/datos.js son exclusivos de bases temporales; no sirven para una instalación con información real.

## Organización y mecanismos conservados

- public/: login y panel, HTML/CSS/Bootstrap 5 y JavaScript vanilla; sin información técnica innecesaria.
- src/: Express, autenticación, autorización, cuentas, estudiantes, expedientes, consultas parametrizadas e informes PDFKit. Transacciones reales y comprobación de permisos dentro de operaciones sensibles.
- database/crear-base.sql: crea SICE solo si no existe. schema.sql: instala las 22 tablas en una base vacía. preparar.js: verifica estructura sin alterarla. administrar.js: sqlcmd con autenticación de Windows para montar y retirar pruebas aisladas.
- test/: seguridad/HTTP, colección sintética, integración SQL Server, cuentas, cambios de expedientes y Chrome. PDF.js solo verifica informes en pruebas.
- database/DISENO.md y REGLAS_FUNCIONALES.md conservan modelo, reglas detalladas y decisiones institucionales pendientes.
- No se usan ORM, Docker, frameworks de interfaz, almacenamiento simulado ni nuevas dependencias para esta limpieza.

## Reglas institucionales que deben preservarse

Director (D), Subdirector (SD), Coordinador de Tutoría (CT), Docente (DO), Auxiliar (AU) y Administrador (AD). Las prohibiciones prevalecen sobre concesiones configurables.

- D/SD consultan internos y restringidos con permiso; CT internos; DO/AU internos propios. AD no consulta estudiantes, expedientes, historial escolar ni PDF. Participar o ser reportante no concede lectura.
- Salud y Protección estudiantil son restringidas; sensibilidad declarada, testigos confidenciales y violencia también protegen el expediente completo, incluidas versiones y actuaciones. Sin clasificador narrativo automático ni acceso parcial.
- Todos los roles operativos pueden reportar un caso sensible; quien pierde acceso tras confirmar o aportar recibe solo constancia. El registrador se obtiene de sesión y puede diferir del reportante. Fechas del servidor, identidad y rol históricos conservados.
- Borradores propios editables mediante nuevas versiones; hechos confirmados sin edición directa. Seguimiento por adición y correcciones enlazadas. Sin eliminación física de incidencias o evidencia.
- Rectificación/anulación exige solicitud, justificación, versión base y decisión independiente por cuenta y persona. D/SD evalúan y deciden; DO/AU solo solicitan dentro de su ámbito. No autoaprobación, solicitudes duplicadas ni decisiones repetidas.
- Resolución documental solo para errores materiales de título/lugar y duplicados comprobados. Hechos, participantes, clasificación o reducción de confidencialidad requieren revisión formal, actualmente bloqueada por falta de composición y quórum. Una propuesta sensible protege inmediatamente el expediente.
- Cierre/reapertura por D/SD/CT dentro del ámbito, motivo y reautenticación. Cerrar requiere revisar actuaciones/plazos y ausencia de solicitudes pendientes; añade conclusión. No se reabren anuladas.
- D/SD/CT crean estudiantes y matrícula de forma atómica; código único, aula activa y año lectivo coherente. No inventar documento ni modificar identidades históricas.
- AD/D/SD solicitan cambios de cuentas. D/SD requieren aprobación recíproca; AD necesita una decisión válida para activación/desactivación/restablecimiento y ambas autoridades para rol/permisos o creación de autoridad/AD.
- En decisiones dobles: ambas aprueban, aprobada; D rechaza, rechazada tras registrar ambas; D aprueba y SD rechaza, revisión por desacuerdo bloqueada.
- AD puede crear cuentas operativas inactivas para personal existente y editar su nombre de acceso. Activación independiente. Sin cambios propios, autoasignación de permisos ni decisión y ejecución por la misma persona.
- Cambios exactos, plazo de 24 horas, fundamento, reautenticación y ejecución única. Conservar al menos una cuenta activa de D/SD/AD y sus permisos esenciales. Revocar sesiones al cambiar cuentas o permisos.
- Conflicto o ausencia de autoridad independiente bloquea decisiones; AD no sustituye autoridades. No inventar suplencias ni desbloqueo unilateral.

Contraseñas scrypt con sal individual; política actual autorizada de 8–12 caracteres con mayúscula, minúscula, número y signo. Sesiones con token resumido, caducidad absoluta de ocho horas/inactividad de treinta minutos, cookies httpOnly/SameSite y protección de origen. Producción exige HTTPS y cookies Secure.

PDF con autorización separada, sin borradores ni contenido fuera del ámbito; firma del registrador histórico, no del descargador, y espacios físicos de firma/sello. Nunca guardar contraseñas, tokens ni hashes de cuentas locales en auditoría o salidas.

## Limpieza de entrega

- Retirados database/migrar-mariadb.js y su comando, dependencia del conector anterior y variables obsoletas de la plantilla. La migración se verificó antes de retirar su herramienta.
- Retirado database/datos-prueba.sql: duplicaba datos sintéticos y cuentas desactivadas; la colección aislada existente cubre las pruebas sin carga sobre SICE.
- .local/, capturas, PDF y respaldos internos ya estaban ausentes. Se conservan configuraciones privadas fuera de Git y todas las bases existentes.
- Se mantienen crear-base.sql, schema.sql, preparar.js y administrar.js por sus funciones distintas. .gitignore cubre también archivos físicos y respaldos de SQL Server.
- README y reglas de trabajo actualizados; contexto consolidado para eliminar instrucciones técnicas caducadas. Los detalles de etapas anteriores ya versionados permanecen consultables en Git.
- Correcciones documentales: tipos DATETIME2, verificador sin creación de tablas, 22 tablas y flujo de autorizaciones realmente implementado.

## Correcciones de auditoría — 24 de noviembre de 2026

1. Operaciones sensibles revalidan cuenta, sesión, credencial, rol y permisos dentro de la transacción. Usan el bloqueo de gestión existente antes de bloquear cuenta y expediente, también en acceso/cierre de sesión. Una escritura termina antes de la desactivación efectiva o se rechaza tras ella; nunca continúa después. La serialización común prioriza consistencia sobre concurrencia de escrituras.
2. Personas: búsqueda y páginas de 50, identidad seleccionada validada individualmente y reserva compartida entre selector y backend. Edición conserva selecciones fuera de la primera página.
3. Registro: formulario bloqueado durante el envío y referencia UUID por operación en `X-SICE-Operation`. Reintentos del mismo usuario/contenido devuelven el registro existente, incluso tras reiniciar; referencia reutilizada con otro contenido devuelve 409. Dos referencias distintas admiten hechos legítimos iguales.
4. Búsqueda parametrizada trata literalmente corchetes, porcentajes, guiones bajos y el escape; conserva código, estudiante, fecha, título, categoría, estado y páginas de 20.
5. Nombres y apellidos validados coherentemente en navegador y servidor: letras Unicode, tildes, espacios, apóstrofes y guiones; rechazo de números y símbolos ajenos al nombre.
6. Límite de reautenticación devuelve 429, mensaje de espera y Retry-After de 900 segundos.
7. Responsables usan la misma consulta para selector y guardado: cuenta/personal activos, consulta y seguimiento, ámbito, reserva y ausencia de conflicto.
8. Detalle muestra el plazo civil junto a la actuación y su responsable, sin desplazar el día por zona horaria.
9. Editar/confirmar borrador y retirar solicitud requieren permiso efectivo también para mostrarse. El servidor conserva sus comprobaciones obligatorias.

No se añadieron tablas, dependencias ni archivos. El recibo de registro reutiliza el evento existente de creación en historial: referencia y huella del contenido, ocultas en el detalle escolar. No contiene credenciales ni se usa para ejecutar instrucciones.

## Verificación y límites

- `npm test`: **7 aprobadas, 0 fallidas**. `node test/interfaz-browser.js`: **59 aprobadas, 0 fallidas**. Total: **66**, las 43 originales y 23 regresiones incorporadas a archivos de pruebas existentes.
- Seis roles en Chrome, login/logout/caducidad, permisos, reserva, cuentas y decisiones independientes, seguimiento, estudiantes, rectificación documental, anulación lógica, cierre y reapertura. Chrome a 1280/1024/768 px; diez PDF de cinco roles operativos y seis categorías verificados en memoria, sin descargas a disco.
- Escenarios reproducidos: ambas secuencias de revocación concurrente, doble confirmación, doble envío, respuesta perdida y reintento, UUID repetido/alterado, búsqueda literal y paginación, nombres inválidos/Unicode, 429, responsable sin permiso de reserva, plazos y botones sin permiso. Catálogo con 260 estudiantes y 260 integrantes del personal adicionales, exclusivamente temporales.
- Registros, versiones, sesiones y referencia de reintento sobreviven al reinicio de Node contra la base temporal. Pérdida de conexión SQL y recuperación comprobadas mediante un puente temporal; no se reinició el servicio SQL Server ni se interrumpieron otras bases.
- La suite comparó todas las filas y columnas de SICE antes/después: sin cambios. Eliminó únicamente su base y login temporales tras verificar servidor, nombre, ID y fecha de creación. Perfil temporal de Chrome retirado; sin capturas, PDF ni auxiliares permanentes.
- Esquema principal verificado: 22 tablas/225 columnas/76 FK/148 CHECK. DBCC CHECKCONSTRAINTS sin infracciones, restricciones activas y confiables, cero bases/cuentas temporales restantes. SQL Server 2022 conservado; sin cambios de esquema, claves locales ni permisos SQL.
- Sintaxis de los 24 JavaScript revisada. Archivos privados excluidos de Git y sin credenciales incorporadas a los cambios. Logo y dependencias conservados.
- El proceso principal responde HTTP 200 en http://127.0.0.1:3000 y se conservó sin reiniciar: el arranque normal purga datos técnicos caducados y esta revisión exige mantener SICE intacta. **Hay que reiniciar ese proceso para cargar las correcciones del backend.** La validación de reinicio se hizo solo en la base aislada.
- No quedaron fallos en los escenarios ejecutados. Las correcciones y pruebas se entregan mediante commits locales separados, sin push ni PR. Esto no habilita las funciones institucionales pendientes.

Pendientes institucionales y de instalación:
1. Composición y quórum de revisión formal con acta; aprobación bloqueada hasta definirlos.
2. Resolución documentada de desacuerdos y doble impedimento.
3. Gestión general de catálogos, provisión inicial de personal/cuentas/catálogos en una instalación vacía y procedimiento de entrega de credenciales; no usar datos sintéticos como sustituto.
4. Validación institucional de matriz, formularios, mínimos, confidencialidad y flujo de cuentas.
5. Conservación, respaldos y despliegue HTTPS. Gestión limitada a NODE_ENV=development; en producción devuelve 503.

Acceso parcial, adjuntos, firmas electrónicas, votaciones, inventario y seguimiento clínico quedan fuera del alcance. No declarar entrega institucional terminada por aprobar pruebas de los flujos implementados.
