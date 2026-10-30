# Contexto de SICE-Local

## Institución y alcance

I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete. Los estudiantes son varones; el personal y los reportantes pueden ser hombres o mujeres. Utilizar el escudo oficial de image/.

Repositorio exclusivo: https://github.com/HugoDP19/PIM-Centro-de-Varones.git. Fase 1 implementada; fases 2.1 y 2.2 documentadas como propuestas pendientes de aprobación. Los siguientes requisitos son futuros, no funcionalidades implementadas.

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
- Se proponen tres columnas adicionales, todavía no incorporadas a DISENO.md: `solicitudes_cambio.id_evaluador`, `solicitudes_cambio.evaluada_en` y `revisiones.requiere_reunion`. No requieren nuevas tablas.
- Commits conservados: `ab0d754` (diseño inicial), `44a56de` (simplificación), `b9d0e51` (revisión integral) y `cf51f7e` (reglas funcionales). La propuesta vigente sustituye las alternativas anteriores sin reescribir su historial.

## Decisiones antes de generar el esquema

1. Aprobar las 19 tablas y los tres ajustes de columnas; contrastar ambos documentos antes de elaborar SQL.
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
