# Contexto de SICE-Local

## Institución y alcance

I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete. Los estudiantes son varones; el personal y los reportantes pueden ser hombres o mujeres. Utilizar el escudo oficial de image/.

Repositorio exclusivo: https://github.com/HugoDP19/PIM-Centro-de-Varones.git. Fase 1 implementada; diseño y reglas consolidados hasta fase 2.4 como propuestas pendientes de aprobación. Fase 2.5: borrador técnico schema.sql preparado por autorización del usuario, sin ejecución MySQL ni aprobación institucional del modelo. Los siguientes requisitos son futuros, no funcionalidades implementadas.

## Requisitos funcionales pendientes

- Seis roles: Director, Subdirector, Coordinador de Tutoría, Docente, Auxiliar y Administrador. Director y Subdirector son las máximas autoridades institucionales.
- El Administrador gestiona usuarios y asigna permisos autorizados, pero no puede editar, eliminar ni aprobar modificaciones de incidencias.
- Categorías: Convivencia, Disciplina, Salud, Seguridad, Bienes y Protección estudiantil. Formularios dinámicos según categoría.
- Registrador y reportante pueden ser personas distintas. Obtener nombre, identificador y rol del registrador de la sesión, y fecha y hora del servidor.
- Permitir correcciones antes de confirmar. Una incidencia confirmada queda protegida y no admite edición directa de los hechos.
- Permitir actuaciones y observaciones autorizadas. Las rectificaciones importantes exigen solicitud, justificación y aprobación independiente.
- Las modificaciones delicadas requieren revisión formal y acta cuando corresponda. Director y Subdirector no pueden aprobar sus propias solicitudes. Aplicar restricciones por conflicto de interés.
- Anulación lógica, nunca eliminación física. Conservar historial y versiones anteriores.
- Permisos configurables con restricciones por acción; proteger datos confidenciales y auditar modificaciones. Contraseñas con hash seguro, sesiones protegidas y cookies httpOnly.

## Decisiones técnicas

- HTML5, CSS3, Bootstrap 5 y JavaScript vanilla; Node.js y Express; MySQL 8 mediante mysql2 y dotenv. Sin frameworks de interfaz, ORM, TypeScript ni Docker.
- PDFKit diferido hasta reportes para evitar una dependencia sin uso actual.
- app.js separado del arranque para probar HTTP en un puerto efímero. Pruebas con node:test.
- Pool MySQL creado solo cuando se solicita. Sin credenciales predeterminadas, datos ficticios ni persistencia en memoria. db:check ejecuta SELECT 1 y falla explícitamente si falta configuración o conexión.
- SQL parametrizado; futuras consultas separadas de rutas. Fechas persistidas en UTC y mostradas en America/Lima.
- Recursos estáticos limitados a public/, image/ y el CSS de Bootstrap. Encabezados básicos de seguridad; autenticación y autorización se implementarán posteriormente.
- Remoto vacío durante la inspección inicial: no existía image/. Se conservó el archivo local ../images/images.jpg y se copió íntegro a image/images.jpg. No había archivos previos del repositorio que sobrescribir.
- Carpetas con contenido útil, sin marcadores vacíos ni capas prematuras.

## Fases propuestas

1. Estructura, configuración y documentación (completada).
2. Diseño MySQL y reglas funcionales (documentados; pendientes de aprobación), seguidos de esquema, autenticación y usuarios cuando se autoricen.
3. Registro y confirmación de incidencias, categorías y seguimiento.
4. Solicitudes de rectificación, aprobaciones independientes, conflictos de interés, actas y auditoría.
5. Reportes PDF con PDFKit y revisión integral de seguridad y accesibilidad.

Las fases posteriores requieren concretar la matriz de permisos, criterios de conflicto de interés y circunstancias de revisión formal y actas con la institución.

## Estado al 30 de octubre de 2026

Estructura inicial, servidor, portada institucional, conexión configurable y pruebas preparados. Sin tablas definitivas, login, administración de usuarios, registro completo, solicitudes, actas ni PDF.

Fase 1 completada con estas verificaciones:

- `npm test`: 2 pruebas aprobadas. HTTP health, portada, logo, CSS y JavaScript disponibles; rutas desconocidas y archivos privados inaccesibles. Validación de configuración MySQL sin conexión simulada.
- Chrome sin ventana, a 320, 768 y 1280 px: ancho del documento igual al viewport, sin desbordamiento horizontal, logo cargado y dentro de pantalla, Bootstrap aplicado y estado «Servidor disponible.».
- SHA-256 del logo copiado idéntico al original: 4AF20CD70E5B21972773FC973E52F439D2870CDE75FC9E4F09955E4F290C211B.
- Instalación npm: 0 vulnerabilidades reportadas en ese momento. package-lock.json conserva las versiones resueltas.
- `npm run db:check`: fallo esperado por ausencia de DB_HOST, DB_NAME, DB_USER y DB_PASSWORD; confirmar también DB_PORT. No se ha verificado una conexión real ni la versión del servidor MySQL. Repetir la comprobación con los datos reales.
- La Fase 1 se preparó inicialmente en local, con commits de servidor, portada y documentación.

## Avances de las fases 2.1 y 2.2

- `database/DISENO.md`: propuesta consolidada de 19 tablas, con identidad común, aulas, apoderados múltiples, participantes, versiones, solicitudes y auditoría. Revisión conceptual de 15 casos: 14 recorridos operativos y el bloqueo cuando ambas autoridades están impedidas.
- `database/REGLAS_FUNCIONALES.md`: matriz de permisos de seis roles, edición por niveles, seis formularios, confidencialidad y aprobación independiente. No se ha aprobado el modelo ni generado esquema SQL, migraciones o datos demo.
- Se proponen tres columnas adicionales, consolidadas en DISENO.md durante la fase 2.3: `solicitudes_cambio.id_evaluador`, `solicitudes_cambio.evaluada_en` y `revisiones.requiere_reunion`. No requieren nuevas tablas.
- Commits conservados: `ab0d754` (diseño inicial), `44a56de` (simplificación), `b9d0e51` (revisión integral) y `cf51f7e` (reglas funcionales). La propuesta vigente sustituye las alternativas anteriores sin reescribir su historial.

## Decisiones antes de generar el esquema

1. Aprobar las 19 tablas y los tres ajustes de columnas; ambos documentos contrastados en fase 2.3; registrar aprobación antes de elaborar SQL.
2. Aprobar permisos, alcance de Docente/Auxiliar y Coordinador, acceso restringido, exportación PDF y recepción de reportes sensibles sin acceso posterior del registrador.
3. Definir revisión documental frente a reunión/acta, composición, quórum, cierre/reapertura y escalamiento si Director y Subdirector están impedidos. Hasta entonces, la decisión queda bloqueada; no se delega al Administrador.
4. Validar formularios, mínimos por tipo, identidad provisional, campos obligatorios y conservación de datos sensibles.
5. Acordar autorización de cuentas/permisos y si se necesita un flujo administrativo automatizado adicional. No se implementan funcionalidades nuevas durante el cierre de jornada.

## Cierre de jornada y continuidad

- El usuario autorizó publicar `main`, `develop` y `feature/base-datos`, crear un PR hacia `develop` e integrarlo tras verificar alcance, pruebas y ausencia de conflictos. `main` permanece en la Fase 1 (`afd2daa`); no recibe cambios de esta fase.
- Flujo: una rama `feature/` por funcionalidad, commits por cambio lógico e integración en `develop` tras validar. No desarrollar directamente en `main`, no reescribir historial ni usar push forzado.
- Antes de publicar se comprobó que el remoto no tenía ramas, se revisaron los archivos versionados y `npm test` aprobó sus dos pruebas. La conexión real a MySQL sigue pendiente de credenciales; no se ha simulado.
- Se revisó la exclusión local `test/` en .gitignore y se retiró: ocultaba pruebas nuevas y no correspondía al proyecto compartido. La prueba existente permanece versionada. `.env`, secretos y node_modules no se publican; `.env.example` contiene únicamente configuración sin credenciales.
- El PR de cierre se titula `docs(database): definir modelo y reglas funcionales`. La publicación e integración se verifican contra GitHub y las referencias remotas al terminar; esta actualización se prepara antes del merge.
- En otra computadora: clonar el repositorio, cambiar a `develop`, ejecutar `npm ci` y `npm test`. Consultar README.md, AGENTS.md y ambos documentos de database/ antes de continuar. Crear una nueva rama `feature/` para la siguiente tarea autorizada.
- Configurar `.env` localmente a partir de `.env.example`; nunca copiar credenciales al repositorio. No comenzar SQL ni migraciones hasta aprobar las decisiones pendientes.

## Avance de fase 2.3 — 31 de octubre de 2026

- Revisión documental terminada; aprobación institucional pendiente. Se leyeron AGENTS.md, este contexto, README.md y los dos documentos de database/.
- Inicio limpio en develop; HEAD y origin/develop coincidían en f8b3ce2, confirmado con git ls-remote. PR #1 integrado según el contexto recibido; rama de trabajo feature/validacion-modelo creada desde ese commit. Sin push ni PR en esta sesión.
- REGLAS_FUNCIONALES.md sección 6 contiene contraste de los 12 puntos, requisitos definidos, problemas y decisiones pendientes. Las 19 tablas se conservan; no se detecta necesidad de relaciones adicionales para el alcance conocido.
- DISENO.md consolida como propuesta id_evaluador, evaluada_en y requiere_reunion. Evaluador/fecha/requiere_revision/fundamento_revision quedan NULL hasta evaluación independiente y se completan juntos; no se resuelve sin evaluar. Se armoniza bloqueo por conflicto para gestión, evaluación, revisión y decisión.
- Pendiente adicional explícito: acordar permisos para gestionar personas, apoderados, aulas, matrículas y tipos. No inferir acceso del Administrador a expedientes.
- Siguiente paso: obtener y registrar decisiones institucionales sobre matriz, revisión/reunión/acta, conflictos y doble impedimento, formularios/mínimos, identidad, confidencialidad, conservación y ajustes del modelo. Presentar la propuesta consolidada; no generar SQL hasta aprobarla.
- Sin cambios de servidor, interfaz, dependencias, logo ni secretos. Validación conceptual y revisión de diff; npm test no se repite por cambios solo documentales. MySQL real, restricciones SQL y seguridad implementada siguen sin verificarse.

## Avance de fase 2.4 — 31 de octubre de 2026

- Cierre documental en feature/validacion-modelo, iniciado con árbol limpio. Base local de fase 2.3: 917b387 (modelo/reglas) y 347ba9f (contexto). Sin push ni PR.
- REGLAS_FUNCIONALES.md distingue requisitos acordados, recomendaciones y validaciones D/SD. Conserva matriz de seis roles y formularios O/C/opcionales; explicita evaluación independiente, evidencia de solicitud/revisión/resolución, límites administrativos y cambios críticos sin nuevo tipo de solicitud.
- Confidencialidad propuesta: expediente completo restringido para Salud, Protección estudiantil, testigos confidenciales y presunta violencia/vulneración en cualquier categoría. Incluye historial y personas enlazadas; bajar protección exige revisar también versiones anteriores. Controles backend documentados, todavía no implementados.
- Se mantienen 19 tablas, sin cambios de columnas o claves en esta fase. DISENO.md aclara el límite de involucrados: solo estudiantes. Caso pendiente: madre reportante y dos trabajadores testigos sin asistir a revisión; no existe relación de esos testigos adultos con el hecho. Si se requiere, evaluar generalizar involucrados a personas con matrícula solo estudiantil, sin ejecutar el ajuste automáticamente. Acceso parcial dentro de un expediente tampoco está cubierto por su nivel único.
- Siguiente paso: registrar validación institucional de matriz, formularios/mínimos, revisión/reunión/acta, conflictos y escalamiento, confidencialidad/conservación, permisos de catálogos y alcance de testigos adultos/acceso parcial. Si ambas autoridades están impedidas, bloquear aprobación; no inventar sustitución. No comenzar SQL ni otra fase hasta resolver las decisiones y autorizar su implementación.
- Verificación de esta fase: contraste documental de reglas, columnas y relaciones; git diff --check sin errores. No se ejecuta npm test porque solo cambia documentación. Sin SQL, migraciones, JavaScript, interfaces, dependencias o cambios del logo; MySQL real y seguridad siguen sin probarse.

## Avance de fase 2.5 — 31 de octubre de 2026

- El usuario autoriza preparar database/schema.sql en feature/validacion-modelo. Esta autorización permite el borrador técnico pese a la pausa documental previa; no aprueba procedimientos institucionales ni despliegue. Inicio con árbol limpio; solo se añaden el script y este avance.
- Script de 19 tablas, 187 columnas, 64 FK y 41 CHECK, InnoDB/utf8mb4. Requiere MySQL 8.0.16 o superior para aplicar CHECK. Conserva las tres columnas propuestas en fase 2.3, sin ampliar el modelo ni insertar roles, permisos o datos demo. Los seis códigos de rol se explicitan como dominio técnico, sin conceder acciones.
- Verificadas estáticamente PK/UQ, destinos únicos y tipos/orden de las FK. Claves compuestas: versión vigente/base/propuesta del mismo expediente, matrícula del estudiante, correcciones del mismo expediente y solicitud/revisión del mismo expediente. Dos ALTER TABLE finales cierran los ciclos, sin desactivar FK; la creación de filas usará referencias opcionales y transacciones posteriores. FK sin acciones explícitas: en InnoDB equivalen a RESTRICT, sin cascadas; también se evita combinar acciones referenciales explícitas con columnas CHECK.
- CHECK cubren dominios, booleanos, documentos completos o NULL, periodos, importes/moneda, contenido de solicitudes, evaluación completa, decisor/evaluador distinto del solicitante por cuenta, resolución de conflictos y requisitos locales de revisión/reunión/acta. No usan columnas AUTO_INCREMENT ni subconsultas. La identidad de personas/usuarios y el reportante independiente se conservan; cero involucrados es posible, con mínimo por tipo pendiente del backend.
- Bloqueo funcional sin resolver: involucrados solo admite estudiantes; no se implementa la generalización a testigos adultos/externos descrita en fase 2.4. personas sí admite reportantes externos y participantes adultos de revisiones. El script no representa varios testigos adultos del hecho ni acceso parcial al expediente; no usarlo para esos casos hasta validar alcance/corrección. No simular relaciones con texto o asistentes ficticios.
- Confidencialidad y conservación no quedan garantizadas por DDL. Backend/privilegios pendientes: matriz (AD sin contenido), independencia por persona/rol/conflictos, sensibilidad y campos por categoría (Salud sin gravedad disciplinaria), mínimos y vigencias, versiones/actas inmutables, sin borrado físico, historial append-only, una solicitud pendiente y resolución atómica. RESTRICT no impide editar hechos ni borrar filas sin referencias; el script no crea usuarios SQL ni concede privilegios. Ambos D/SD impedidos sigue bloqueando aprobación.
- Validación realizada: comprobación estructural temporal con Node de nombres, PK/UQ, columnas, tipos/destinos/orden de las 64 FK, restricciones nominales únicas de hasta 64 caracteres, paréntesis/comillas y ausencia de CHECK sobre AUTO_INCREMENT. Contraste de las 19 tablas y sus 159 columnas principales documentadas, más revisión de campos de categoría y destinos de historial; sin columnas principales ausentes. Revisión de índices, sin narrativas indexadas; InnoDB genera los índices de FK no cubiertos por PK/UQ/índices explícitos. git diff --check sin errores. Esto no es una validación de sintaxis mediante el motor ni una prueba de rechazo de datos inválidos.
- No se encontró cliente mysql en PATH ni servicio local MySQL/MariaDB; no se verificó una instancia MySQL 8 disponible. No se leyó ni usó .env, no se conectó ni modificó ninguna base. No se ejecuta npm test: no hay cambios del servidor. No se crean pruebas con otra base o persistencia simulada.
- Siguiente paso: resolver decisiones institucionales y testigos adultos/acceso parcial; después, con autorización para una base temporal vacía en MySQL 8, ejecutar el script completo y comprobar restricciones/casos inválidos, sin datos demo persistentes ni afectar bases existentes. El script no crea/selecciona/elimina bases y no es una migración idempotente. Revisar cualquier fallo DDL en la base temporal: no continuar ignorando errores. No iniciar backend/frontend ni publicar sin autorización.
