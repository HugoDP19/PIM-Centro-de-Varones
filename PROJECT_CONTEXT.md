# Contexto de SICE-Local

## Institución y alcance

I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete. Los estudiantes son varones; el personal y los reportantes pueden ser hombres o mujeres. Utilizar el escudo oficial de image/.

Repositorio exclusivo: https://github.com/HugoDP19/PIM-Centro-de-Varones.git. Fase 1 limitada a estructura, configuración, portada y documentación. Los siguientes requisitos son futuros, no funcionalidades implementadas.

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

1. Estructura, configuración y documentación (actual).
2. Validación del modelo MySQL, permisos, autenticación y usuarios.
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
- Trabajo local, sin push, Pull Request ni publicación. Cambios agrupados en commits de configuración del servidor, portada y documentación.
