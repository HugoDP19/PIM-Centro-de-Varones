# SICE-Local

Sistema de registro y seguimiento de incidencias escolares de la I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete.

Disponible en desarrollo: autenticación, cuentas y permisos con autorización independiente, registro de seis categorías, borradores, confirmación, consulta, seguimiento, historial e informes PDF institucionales. La matriz y los formularios fueron autorizados para desarrollo; los módulos de gestión permanecen bloqueados en producción hasta su validación institucional.

## Preparación local

Requiere Node.js 24 o superior y MySQL 8. Validado con MySQL 8.0.46 en `127.0.0.1:3306`.

1. Ejecutar `npm ci`.
2. Configurar `.env` desde `.env.example`: `NODE_ENV=development`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_NAME=SICE` y las credenciales SQL locales. No compartirlas ni versionarlas.
3. Ejecutar `npm run db:prepare`. Crea únicamente `SICE` si no existe; si existe, comprueba el esquema sin sobrescribir datos. No es una herramienta de migración de instalaciones anteriores.
4. En una instalación nueva, ejecutar `npm run db:escolar`. Es el único comando de carga escolar: prepara 24 expedientes y seis cuentas con nombres sintéticos naturales. Repetirlo no crea duplicados ni restablece contraseñas. La instalación actual ya tiene la colección y no necesita recargarla.
5. Ejecutar `npm start`, abrir http://127.0.0.1:3000 e ingresar. El botón «Abrir panel institucional» lleva a `/panel.html`. Para desarrollo con reinicio: `npm run dev`.

En PowerShell con scripts deshabilitados, usar `npm.cmd`. `APP_ORIGIN` debe coincidir exactamente con el origen del navegador, incluido el puerto. El servidor verifica conexión y columnas necesarias antes de escuchar; si falta configuración o esquema, termina con un mensaje comprensible. `db:prepare` solo ejecuta DDL en bases nuevas; sobre una base existente verifica, sin borrar ni reparar a ciegas. El lector de DDL rechaza instrucciones `USE`, `CREATE DATABASE` o sentencias ajenas a CREATE/ALTER TABLE.

La base actual tiene **22 tablas**: las 19 del modelo escolar, dos técnicas de autenticación y una de autorizaciones concretas de cuentas. `involucrados` relaciona personas; los adultos no reciben matrículas ficticias. Se mantienen 187 columnas, 64 FK y 41 CHECK en las 19 tablas del esquema escolar.

El 2 de noviembre de 2026 se migraron a `SICE` los **24 expedientes escolares seleccionados**, con sus 28 versiones, 30 participaciones, 51 actuaciones, cinco solicitudes, una revisión, cuatro participantes y un conflicto. Se conservaron las siete cuentas vigentes, sus permisos y la auditoría relacionada (300 eventos). No se incluyeron sesiones ni límites de acceso antiguos. `sice_desarrollo` permanece intacta con sus 58 incidencias, incluidos los prototipos y registros de verificación. El respaldo completo y las configuraciones originales están fuera del repositorio, en `%LOCALAPPDATA%\SICE\respaldos\respaldo-2026-11-02-ac716c\`. MySQL en Windows normaliza físicamente el nombre a `sice` (`lower_case_table_names=1`); la configuración usa `SICE`.

## Cuentas de la colección escolar

Las contraseñas de acceso se consultan localmente en `.env.escolar.local`, ignorado por Git, como `<ROL>_PASSWORD`. No compartir ni versionar ese archivo. Para crear o restablecer una clave se exigen entre **8 y 12 caracteres**, con al menos una mayúscula, una minúscula, un número y un signo; el backend valida la regla y conserva el hash scrypt con sal individual. La carga nueva genera claves aleatorias que cumplen estas condiciones.

La configuración se limita a `.env` (servidor/MySQL) y `.env.escolar.local` (las seis variables institucionales `<ROL>_PASSWORD`). En esta instalación, las seis cuentas institucionales comparten la contraseña inicial indicada en ese archivo; MySQL conserva un hash scrypt con sal independiente para cada una. Se retiraron las doce variables históricas `DEMO_*_PASSWORD` y `PRUEBAS_*_PASSWORD`, sin uso actual, y `CUENTA_PASSWORD`, cuyo valor era redundante. La cuenta adicional `rvega` se conserva sin cambios y su clave vigente coincide con la inicial institucional; no requiere otra variable local.

| Usuario | Rol |
| --- | --- |
| `rsalazar` | Director |
| `mhuaman` | Subdirector |
| `jparedes` | Coordinador de Tutoría |
| `lramos` | Docente |
| `ctorres` | Auxiliar |
| `hugodp19` | Administrador — Hugo Vargas |
| `rvega` | Docente (cuenta adicional de esta instalación) |

Para ingresar, abrir http://127.0.0.1:3000 y escribir el usuario de la tabla y su clave local. Para cambiar de cuenta, cerrar la sesión actual. El 12 de noviembre de 2026 se verificó la contraseña inicial común y se regeneraron los hashes de las seis cuentas institucionales mediante el mecanismo existente, revocando sus sesiones anteriores. Fue un mantenimiento local solicitado por el usuario: conserva roles, permisos, autores históricos y los 24 expedientes, sin cambiar el flujo de autorización de cuentas de la aplicación ni otras bases existentes.

El Director o Subdirector autoriza un cambio concreto de cuenta o permiso. Un Administrador independiente lo ejecuta sin poder cambiar los datos autorizados. Se admite crear una cuenta para personal existente, actualizar rol/usuario/estado, restablecer contraseña y asignar/retirar permisos compatibles con el rol. No hay cambios sensibles sobre la propia cuenta ni autoasignación por rol; se revalidan autoridad, vigencia y estado del objetivo. La autorización vence en 24 horas, admite una sola ejecución y ambas etapas se auditan. Las contraseñas se proporcionan solo al crear/restablecer, se guardan con hash y nunca forman parte de la autorización ni del historial.

## Incidencias e informes

La matriz aplicada en desarrollo exige permiso específico por acción: D/SD pueden consultar internos y restringidos; Coordinador, internos; Docente/Auxiliar, internos registrados por ellos; Administrador, ningún expediente. Conflictos pendientes o inhibiciones bloquean al afectado. Los filtros se aplican también a búsquedas, detalle, versiones, seguimiento, historial y PDF. Los catálogos ofrecen identificación mínima y excluyen identidades de casos reservados a accesos sin permiso; no habilitan administrar personas ni catálogos escolares.

El registrador, su nombre histórico, rol y fechas de registro se obtienen de la sesión/servidor. El reportante se selecciona separadamente. Se guarda un borrador explícito, se revisa y se confirma. Al confirmar se validan los campos por categoría y el mínimo estudiantil configurado en el tipo; una incidencia admite cero, uno o varios estudiantes y también testigos adultos. Los hechos confirmados no se editan ni se eliminan físicamente. El seguimiento se agrega como actuación u observación; una corrección referencia la actuación anterior y conserva ambas.

Salud y Protección estudiantil se restringen automáticamente. En las demás categorías el registrador debe declarar la sensibilidad del contenido; no hay un clasificador automático de narrativas. Testigos confidenciales, presunta violencia u otra información sensible exigen marcar la reserva. Añadir seguimiento sensible eleva la protección en la misma transacción; quien pierda acceso recibe solo constancia. Esta interfaz no reduce confidencialidad.

El PDF requiere permiso de consulta y exportación y un expediente confirmado dentro del ámbito del usuario. Usa PDFKit, A4, blanco/guinda, logo original, tablas, siete secciones, código, emisión en hora de Lima y numeración de páginas. Firma y cargo corresponden a la identidad histórica del registrador, aunque descargue otro usuario. Solo se reservan espacios para firma y sello del Director físicos; no se insertan firmas ni sellos falsos. Se genera al descargar desde el detalle del expediente, sin guardar ejemplos en el proyecto. La interfaz prioriza computadoras y laptops, con adaptación básica para ventanas pequeñas.

Los escenarios cargados de rectificación, rechazo, anulación, reunión/acta e inhibición son datos para revisión. Presentar y resolver nuevas solicitudes, cerrar/reabrir casos y administrar catálogos siguen pendientes de los criterios institucionales correspondientes. No se simulan esos flujos.

## Seguridad y API

Sesiones revocables en MySQL: tokens aleatorios de 256 bits guardados como SHA-256, expiración de 8 horas e inactividad de 30 minutos; rotación al ingresar. Hash de contraseñas scrypt con sal individual (`N=131072`, `r=8`, `p=1`). Cookies `HttpOnly`, `SameSite=Strict` y `Secure`/prefijo `__Host-` en producción. Se revalidan cuenta/persona, contraseña, rol y permisos en cada solicitud. Límites de intentos persistidos: 10 por cuenta y 100 por IP en 15 minutos. Se auditan accesos/cierres sin secretos.

| Ruta | Uso |
| --- | --- |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/sesion` | Autenticación y sesión |
| `GET /api/incidencias`, `GET /api/incidencias/catalogos`, `GET /api/incidencias/:id` | Listado paginado, catálogos mínimos y detalle autorizado |
| `POST /api/incidencias`, `PUT /api/incidencias/:id/borrador`, `POST /api/incidencias/:id/confirmar` | Registro y confirmación |
| `POST /api/incidencias/:id/actuaciones`, `GET /api/incidencias/:id/pdf` | Seguimiento e informe |
| `GET /api/cuentas/catalogos`, `GET /api/cuentas/autorizaciones`, `POST /api/cuentas/autorizaciones`, `POST /api/cuentas/autorizaciones/:id/ejecutar` | Gestión independiente de cuentas |

Las escrituras requieren JSON, `Origin` igual a `APP_ORIGIN` y `X-SICE-Request: 1`, enviados por la interfaz. Sin CORS ni tokens en localStorage. No se exponen errores SQL al cliente. Producción requiere HTTPS; `TRUST_PROXY_LOCAL=1` solo detrás de un proxy HTTPS local de confianza. Faltan certificados/proxy y una cuenta SQL de privilegios mínimos para despliegue. `/api/health` indica disponibilidad HTTP; `npm run db:check` comprueba MySQL.

## Pruebas y datos

```text
npm test
npm run db:check
npm run test:mysql
```

`test:mysql` lee `SICE` en una transacción de solo lectura y crea una copia temporal `sice_test_<identificador aleatorio>`. Comprueba la carga inicial y repetida con rollback, y ejecuta las pruebas de escritura, sesiones, permisos y PDF únicamente en esa copia. Antes de eliminarla exige creación propia, nombre exacto, misma conexión y mismo servidor; si la identidad no coincide, detiene el borrado. Al finalizar compara las cantidades y huellas de estructura/datos de las 22 tablas de `SICE`, incluidos sus 24 expedientes. Requiere permisos SQL para crear/eliminar esa base temporal. No modifica expedientes, cuentas, sesiones ni auditoría de `SICE` ni de bases existentes. Las contraseñas de prueba nuevas son aleatorias y permanecen en memoria.

`node test/interfaz-browser.js` ejecuta la misma suite aislada y abre un servidor temporal para Chrome a 1280/1024/768 px; no requiere `npm start`. Comprueba acceso, registro, seguimiento y autorización/ejecución de cuentas. `CHROME_PATH` permite indicar la ruta del navegador local. El perfil de Chrome se crea en el directorio temporal del sistema y se elimina al finalizar. No se guardan capturas ni PDF de prueba. PDF.js inspecciona páginas y contenido en memoria; PDFKit genera los informes del servidor.

La colección cubre las seis categorías y estados confirmada/en seguimiento/cerrada/anulada. Los expedientes escolares contienen datos sintéticos; la cuenta administrativa usa el nombre configurado expresamente por el usuario. Los resultados y límites de cada etapa se registran en [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Organización

`public/` contiene interfaz y JavaScript vanilla; `src/`, servidor, reglas, rutas y consultas SQL separadas; `database/`, los tres esquemas SQL, el preparador y una carga escolar con sus casos; `test/`, pruebas. Se conservan `image/` y el logo original. Sin ORM, React, Angular, TypeScript ni Docker. No se agregaron dependencias durante la limpieza.

Referencias técnicas: [PDFKit](https://pdfkit.org/docs/getting_started.html), [contraseñas de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) y [sesiones de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Las decisiones institucionales pendientes se mantienen en `PROJECT_CONTEXT.md` y los documentos de diseño/reglas de `database/`.
