# SICE-Local

Registro, seguimiento e informes de incidencias escolares para la **I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete**.

Proyecto para revisión del profesor. Las funciones están habilitadas en desarrollo; el uso institucional en producción requiere validación. No hay eliminación física de expedientes.

## Requisitos y ejecución

- Node.js 24 o superior, Express, mysql2 y MariaDB 10.11.16 de XAMPP.
- HTML, CSS, Bootstrap y JavaScript vanilla; PDFKit para informes.
- MariaDB local en `127.0.0.1:3306`, base `sice_local`.

```text
npm ci
npm run db:check
npm run db:prepare
npm start
```

Abrir http://127.0.0.1:3000. `npm run dev` reinicia al editar código. En PowerShell, usar `npm.cmd` si la ejecución de scripts está deshabilitada.

Conservar el `.env` de cada computadora. Para una instalación nueva, partir de `.env.example` y configurar la conexión real, sin publicar claves. `src/database.js` carga la configuración y establece `NODE_ENV=development` en el proceso cuando falta y DB_HOST es `127.0.0.1`; respeta valores explícitos como `production` y `test`. No escribe archivos. APP_ORIGIN debe coincidir con el origen y puerto del navegador.

La cuenta de aplicación conserva SELECT, INSERT y UPDATE sobre `sice_local`. DELETE se limita a las concesiones previas sobre `sesiones`, `intentos_acceso`, `roles_permisos` e `involucrados`; la edición actual ya no usa DELETE de participantes, porque conserva cada versión. El backend impide editar hechos confirmados o eliminar expedientes. No tiene CREATE, ALTER, DROP ni privilegios administrativos.

## Instalación y mantenimiento de la base

`database/schema.sql` contiene las **22 tablas**, sus índices, 76 FK y 51 CHECK. Usa InnoDB, utf8mb4 y `utf8mb4_unicode_ci`. Para una base nueva y vacía, una cuenta administradora crea la base y ejecuta el esquema completo desde el cliente de MariaDB:

```sql
CREATE DATABASE sice_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sice_local;
SOURCE D:/PIM - Hugo/PIM-Centro-de-Varones/database/schema.sql;
```

Ajustar la ruta al clon local. No ejecutar el esquema completo sobre una base que ya tenga tablas.

Si ya existen las 19 tablas escolares, `npm run db:prepare` verifica su estructura y crea solo las técnicas que falten: `sesiones`, `intentos_acceso` y `autorizaciones_cuentas`. Valida el DDL con PREPARE antes de ejecutarlo. No recrea ni altera tablas existentes, no carga registros, no concede permisos y no cambia contraseñas. Si la estructura existente es incompatible, se detiene; no hace reparaciones automáticas. Al repetirlo con las 22 tablas, solo verifica.

La creación requiere una cuenta administradora para esa operación. Como alternativa, un administrador puede conceder CREATE temporal solo sobre las tres tablas y revocarlo después de `npm run db:prepare`:

```sql
GRANT CREATE ON sice_local.sesiones TO 'sice_user'@'127.0.0.1';
GRANT CREATE ON sice_local.intentos_acceso TO 'sice_user'@'127.0.0.1';
GRANT CREATE ON sice_local.autorizaciones_cuentas TO 'sice_user'@'127.0.0.1';
-- Ejecutar npm run db:prepare antes de las tres revocaciones siguientes.
REVOKE CREATE ON sice_local.sesiones FROM 'sice_user'@'127.0.0.1';
REVOKE CREATE ON sice_local.intentos_acceso FROM 'sice_user'@'127.0.0.1';
REVOKE CREATE ON sice_local.autorizaciones_cuentas FROM 'sice_user'@'127.0.0.1';
```

Los DELETE se conceden de forma específica; los de roles_permisos e involucrados fueron autorizados expresamente para conservar las operaciones correspondientes:

```sql
GRANT DELETE ON sice_local.sesiones TO 'sice_user'@'127.0.0.1';
GRANT DELETE ON sice_local.intentos_acceso TO 'sice_user'@'127.0.0.1';
GRANT DELETE ON sice_local.roles_permisos TO 'sice_user'@'127.0.0.1';
GRANT DELETE ON sice_local.involucrados TO 'sice_user'@'127.0.0.1';
```

La preparación realizada el 20 de noviembre de 2026 utilizó la cuenta administradora configurada en XAMPP, sin cambiar credenciales ni conceder DDL a la aplicación. Se conservaron la estructura y todos los registros de las 19 tablas. Git no sincroniza las bases de distintas computadoras.

Workbench y el backend usan el mismo destino local `127.0.0.1:3306`, esquema `sice_local` (confirmado durante la revisión). Los perfiles de Workbench no guardan un esquema predeterminado; seleccionarlo explícitamente para consultar los mismos registros. El perfil del puerto 3307 corresponde a otro destino. Comprobación de lectura en Workbench:

```sql
USE sice_local;
SELECT DATABASE() AS base, @@port AS puerto, VERSION() AS version;
SELECT i.id, i.estado, v.titulo, v.descripcion, v.lugar
FROM incidencias i JOIN versiones_incidencia v ON v.id = i.id_version_vigente
ORDER BY i.id;
```

Las páginas consultan y guardan por HTTP en los módulos SQL de `src/`. Usuarios/roles/permisos, sesiones, estudiantes/matrículas, incidencias/versiones/participantes, seguimiento, solicitudes de cuentas e historial persisten en MariaDB. No hay repositorios persistentes en memoria ni localStorage como base de datos; las variables de interfaz y los Set de filtrado solo contienen estado de la petición o pantalla. El PDF se genera desde consultas al mismo expediente.

## Funciones y límites

- Login/logout, sesiones revocables, expiración y protección de origen para escrituras.
- Seis roles con permisos efectivos y restricciones por confidencialidad y conflicto. El Administrador no accede a expedientes.
- Solicitudes y decisiones independientes sobre cuentas, reautenticación y ejecución única.
- Seis categorías, borradores, confirmación, consulta con páginas de 20 y búsqueda por código, estudiante autorizado, fecha o título.
- Seguimiento, versiones, historial y PDF institucional con logo, firma y sello físicos.
- Propuestas de rectificación con nueva versión y participantes conservados, evaluación y decisión independiente; retirada y rechazo sin borrar evidencia. Las correcciones materiales de título/lugar pueden resolverse documentalmente.
- Anulación lógica por duplicado comprobado, con referencia al expediente que continúa; no se elimina ni se reabre una incidencia anulada.
- Cierre con actuación de conclusión y revisión de actuaciones/plazos; reapertura motivada. Solo D/SD y CT dentro de su ámbito, con contraseña actual y sin solicitudes pendientes.
- Registro de estudiantes y matrícula para D/SD/CT, autorizado expresamente, con reautenticación, controles de código/aula/año y auditoría. Persona, estudiante y matrícula se guardan en una sola transacción.

Pendientes: aprobación de cambios de hechos/participantes, anulación controvertida o reducción de confidencialidad que exijan revisión formal y acta; el usuario indicó que definirá composición y quórum, todavía no suministrados. Se pueden registrar, evaluar, rechazar o retirar esas propuestas, pero no aprobarlas omitiendo la revisión. Continúan pendientes administración general de catálogos, resolución institucional de desacuerdos o impedimentos, conservación, respaldos y despliegue HTTPS. Las reglas están en `database/REGLAS_FUNCIONALES.md`.

Las operaciones sensibles de expedientes piden contraseña actual y limitan intentos. Decidir exige autoridad distinta del solicitante por cuenta y persona, ausencia de conflicto y versión base vigente. El servidor vuelve a validar sesión, cuenta y permisos dentro de la transacción, bloquea el expediente y conserva versiones, participantes, decisiones y motivos. Incluso editar un borrador añade una versión; no elimina los participantes históricos. Una propuesta reservada eleva la confidencialidad del expediente completo inmediatamente; no se permite bajar la protección de evidencias conservadas.

La revisión local del 20 de noviembre de 2026 añadió expresamente estas cuentas de prueba, activas y con hashes scrypt y sales independientes:

| Usuario | Rol |
| --- | --- |
| prueba_director | Director |
| prueba_subdirector | Subdirector |
| prueba_tutoria | Coordinador de Tutoría |
| prueba_docente | Docente |
| prueba_auxiliar | Auxiliar |
| prueba_admin | Administrador |

La contraseña común fue suministrada en la conversación y no se guarda en el repositorio. Se añadieron los seis roles, sus permisos según el código, un tipo por categoría, un estudiante con aula/matrícula y seis expedientes sintéticos de prueba. Estas cuentas y registros pertenecen solo a esa base local; no forman parte de la instalación ni sustituyen datos institucionales. La instalación no crea cuentas ni expedientes automáticamente.

La comprobación posterior de persistencia reutilizó las seis cuentas y añadió solo el estudiante sintético `TEST-EST-002`, su matrícula en el aula de prueba existente y el borrador `INC-000008` sobre turnos de participación en primaria. Se creó y editó con el formulario real de Chrome; título, descripción, lugar, estudiante, matrícula e historial se contrastaron con SELECT. La sesión y el registro siguieron disponibles tras detener el proceso servidor de verificación e iniciar otro con la misma base, sin cambiar `.env` ni sobrescribir los siete registros anteriores de personas.

## Pruebas

```text
npm test
npm run test:mysql
node test/interfaz-browser.js
```

`npm test` comprueba seguridad, configuración y HTTP. `test:mysql` conserva el nombre del comando y prueba MariaDB: crea una base temporal propia `sice_test_<identificador>`, instala el esquema, genera credenciales solo en memoria y carga fixtures exclusivos de `test/datos.js`. Comprueba seis roles, confidencialidad, decisiones, FK/CHECK y PDF. Compara estructura y registros de origen antes y después; no requiere una colección ni claves en la base local.

Incluye una regresión de persistencia: registra y edita por HTTP, contrasta los campos con SELECT, cierra servidor y conexiones y consulta desde un proceso nuevo de `src/server.js` con la misma sesión. La revisión de expedientes y estudiantes aprobó 36 pruebas de integración/Chrome, además de las siete básicas. La comparación del origen omite solo ultima_actividad_en de sesiones, que cambia al consultar desde un navegador abierto; nuevas sesiones, expedientes o auditorías concurrentes siguen haciendo fallar esa comprobación y requieren repetirla sin actividad externa.

La cuenta de aplicación no crea bases de pruebas. Para esa suite se puede proporcionar `DB_SETUP_USER` y `DB_SETUP_PASSWORD` solo al proceso de prueba con una cuenta administradora; no guardarlas en `.env` ni en archivos nuevos. El montaje concede a la aplicación DML únicamente sobre su base temporal, lo revoca al terminar y elimina solo esa base propia. Nunca ejecutar fixtures contra `sice_local`. No hay comandos de carga de demostración ni dependencia de `.env.escolar.local`.

La variante de interfaz añade Chrome a 1280/1024/768 px; `CHROME_PATH` indica su ejecutable. En un entorno restringido donde Chrome no puede iniciar su proceso de página, `CHROME_NO_SANDBOX=1` permite ejecutar exclusivamente ese navegador de prueba sin su sandbox; no se activa por defecto y usa un perfil temporal aislado. Guarda el perfil en el directorio temporal del sistema y trabaja con PDF en memoria. Ejecutar una sola variante funcional por revisión y evitar actividad concurrente que altere la comparación de sesiones. `TEST_PASSWORD` permite proporcionar al proceso una clave común de prueba sin escribirla en archivos; si no se define, la suite genera claves aleatorias en memoria.

Se conservan las pruebas de HTTP/recursos y seguridad, la integración de incidencias/cuentas y la variante de navegador: cubren controles distintos. `test/datos.js` prepara exclusivamente los escenarios necesarios para esas regresiones, sin comandos de demostración ni archivos de claves. Las cinco dependencias de ejecución sirven al backend, conexión, configuración, estilos e informes; PDF.js es solo de desarrollo para comprobar el contenido y los márgenes de los PDF. `package-lock.json` permite reproducir sus versiones.

## Organización

| Ruta | Función |
| --- | --- |
| `database/schema.sql` | Fuente única del esquema completo |
| `database/preparar.js` | Preparación técnica y verificación de columnas, PK, índices, FK y CHECK |
| `database/DISENO.md` | Explicación del modelo y decisiones de datos |
| `database/REGLAS_FUNCIONALES.md` | Matriz de acceso, reglas y pendientes institucionales |
| `src/`, `public/` | Backend y frontend |
| `test/` | Pruebas y fixtures aislados de instalación y ejecución |
| `image/` | Logo institucional original |

`.gitignore` excluye secretos, dependencias, respaldos y resultados temporales. El historial de trabajo y las verificaciones están en [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).
