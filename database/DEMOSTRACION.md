# Colección escolar y verificación

Todos los nombres y datos son sintéticos; no corresponden a personas ni expedientes reales del colegio. La identificación del entorno aparece fuera del contenido administrativo de los informes y del panel. No se obtuvieron datos personales de internet, no se asignaron documentos reales y no se inventaron diagnósticos.

## Carga reproducible

```text
npm run db:prepare
npm run db:escolar
npm start
```

Si la base viene de la fase anterior, ejecutar primero `npm run db:update`. Este comando modifica exclusivamente `sice_desarrollo`, conserva las relaciones anteriores y no elimina filas. `db:prepare` verifica una base existente; nunca reejecuta el esquema sobre sus datos. `db:escolar` y su alias `db:demo` requieren desarrollo local, usan transacción/bloqueo y no generan duplicados ni restablecen claves al repetirse.

Las cuentas actuales y sus roles se enumeran en README.md; contraseñas aleatorias solo en `.env.escolar.local`, excluido de Git. El cargador crea personal, estudiantes varones, apoderadas con vínculos, matrículas en cuatro aulas de primaria/secundaria y un testigo externo. Dos identidades adicionales de personal permiten comprobar creación de cuentas sin inventar una persona desde la administración.

## Los 24 expedientes de la colección

La numeración siguiente identifica escenarios de la carga, no la PK del expediente. En la interfaz el código se deriva de esa PK: `INC-000024`, por ejemplo. Los códigos pueden variar entre instalaciones. Los tipos y fechas se obtienen de MySQL; las matrículas aportan nivel, grado y sección.

| Escenario | Contenido |
| --- | --- |
| 1 | Discusión con agresión durante recreo, dos involucrados y un testigo estudiantil |
| 2 | Expresiones ofensivas reiteradas y acompañamiento de Tutoría |
| 3 | Posible acoso reportado por apoderada, pendiente de contraste |
| 4 | Presentación personal con justificación familiar por evaluar |
| 5 | Tardanzas, entrevista y seguimiento posterior |
| 6 | Salida del aula y explicación del estudiante |
| 7 | Desmayo en formación, atención inmediata y comunicación familiar |
| 8 | Malestar durante clase y seguimiento al día siguiente |
| 9 | Angustia emocional con datos mínimos y reserva |
| 10 | Caída durante educación física, sin gravedad disciplinaria |
| 11 | Cable expuesto sin estudiantes afectados |
| 12 | Piso mojado, señalización y medida preventiva |
| 13 | Mochila extraviada y recuperada, sin atribuir sustracción |
| 14 | Ventana dañada accidentalmente y circunstancias por contrastar |
| 15 | Objeto no localizado, sin señalar responsables |
| 16 | Posible maltrato y derivación protectora, sin relato explícito |
| 17 | Posible desprotección pendiente de evaluación |
| 18 | Auxiliar registrador y docente reportante diferentes |
| 19 | Testigo adulto externo relacionado con la versión, sin matrícula y con expediente reservado |
| 20 | Rectificación documental aprobada por autoridad independiente; versión original conservada |
| 21 | Rectificación rechazada; propuesta conservada sin sustituir la versión vigente |
| 22 | Anulación lógica por duplicación del escenario 11, sin borrar datos |
| 23 | Revisión concluida con reunión, cuatro participantes y acta; solicitud pendiente |
| 24 | Director inhibido por conflicto; solicitud pendiente y sin sustitución por Administrador |

Las comunicaciones a la familia se incluyen donde corresponden; en Protección estudiantil permanecen sujetas a evaluación de seguridad. Accidentes y Salud no reciben gravedad disciplinaria. Las descripciones distinguen observaciones y relatos, sin atribuir culpabilidad no verificada.

Los escenarios 20–24 son datos preparados para revisión, no resultados producidos por nuevos módulos de solicitudes o aprobación. El escenario 25 se cubre con pruebas de acceso/modificación no autorizados, sin adulterar un hecho histórico para representarlo.

## Estado comprobado al cierre

En `sice_desarrollo`: **58 incidencias**: 24 de la colección escolar, 23 prototipos anteriores conservados y 11 registros adicionales de verificación por API/navegador. La colección contiene 28 versiones y los estados actuales son 3 confirmadas, 14 en seguimiento, 6 cerradas y 1 anulada. El seguimiento de uno de sus casos avanzó durante la prueba real; el cargador no restablece ese estado ni su historial.

Los prototipos anteriores y sus identidades se conservan en SQL; no se presentan en el panel escolar ni en sus catálogos. Las consultas de `consultar-demo.sql` muestran los expedientes de la presentación actual. Su uso en Workbench es una revisión local autorizada y no habilita acceso desde la aplicación a un rol sin permiso.

## Verificación efectuada

- MySQL 8.0.46 real, 19 tablas escolares, 187 columnas, 64 FK y 41 CHECK, más tres tablas técnicas: 22 tablas totales. Migración de involucrados con 28 relaciones anteriores conservadas. No se modificó `sice_pruebas` ni ninguna otra base en esta etapa.
- `npm test`: 5 pruebas aprobadas. `npm run test:mysql`: 15 pruebas aprobadas, con las seis categorías, mínimo estudiantil, borrador, confirmación concurrente, roles/ámbitos, reserva, testigo adulto, seguimiento, auditoría, cuentas independientes y PDF. Los rechazos FK/CHECK se revierten; la suite conserva sus registros sintéticos y auditoría.
- Login inválido/rotación/logout comprobados. SQL parametrizado; autoría impuesta por sesión; campos de otra categoría rechazados; fechas, importes y matrículas validados. Hechos confirmados no editables y eliminación física no expuesta.
- Creación/restablecimiento/cambio de estado de cuenta probados, con hash, revocación de sesiones, autorización de un solo uso y rechazo de cambios propios/permisos incompatibles. Revocar/restaurar un permiso se ejecuta por el flujo autorizado, no mediante una persistencia simulada.
- PDF A4 real: siete secciones, logo, código/emisión/páginas, nombre y cargo históricos del registrador aunque descargue otro usuario. PDF.js comprueba contenido y posiciones de firma/sello. Informe representativo de 2 páginas y comprobación extensa de 18 páginas, con texto junto a las firmas; sin firmas ni sellos falsos.
- Chrome a 320/768/1280 px: login, panel de cuentas, listado, formularios y detalle sin desbordamiento; registro/confirmación/seguimiento y autorización por Director/ejecución por Administrador comprobados desde la interfaz. En móviles el listado se presenta como tarjetas.

Capturas y PDF locales: `.local/verificacion/`, ignorado por Git. Las contraseñas de comprobación de la cuenta adicional se guardan únicamente en `.env.integral.local`. La suite anterior que preparaba `sice_pruebas` fue sustituida por una que utiliza solo `sice_desarrollo`, conforme al alcance actual.

## Límites vigentes

La matriz, formularios O/C y flujo de cuentas están autorizados para desarrollo. En producción la gestión devuelve 503 hasta la validación institucional. No están implementados los flujos para nuevas rectificaciones/anulaciones, criterios de revisión/reunión/acta, cierre/reapertura, doble impedimento, administración de catálogos ni acceso parcial a una identidad dentro de un caso.

El usuario declara la sensibilidad del contenido; el sistema impone los mínimos de Salud/Protección y eleva protección cuando se declara información sensible. No se promete clasificación automática de una narrativa. La aplicación no ofrece reducción de confidencialidad.

La cuenta SQL local sigue siendo una configuración de desarrollo: faltan privilegios mínimos y transporte HTTPS real de producción. No se declara inmutabilidad frente a acceso SQL administrativo, ni implantados procedimientos institucionales pendientes.
