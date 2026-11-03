# SICE-Local

Sistema de registro y seguimiento de incidencias escolares de la I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete.

Disponible en desarrollo: autenticación, cuentas y permisos con autorización independiente, registro de seis categorías, borradores, confirmación, consulta, seguimiento, historial e informes PDF institucionales. La matriz y los formularios fueron autorizados para desarrollo; los módulos de gestión permanecen bloqueados en producción hasta su validación institucional.

## Preparación local

Requiere Node.js 24 o superior y MySQL 8. Validado con MySQL 8.0.46 en `127.0.0.1:3306`.

1. Ejecutar `npm ci`.
2. Configurar `.env` desde `.env.example`: `NODE_ENV=development`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_NAME=sice_desarrollo` y las credenciales SQL locales. No compartirlas ni versionarlas.
3. Base nueva: `npm run db:prepare`. Base de la fase anterior: `npm run db:update` y después `npm run db:prepare`. La actualización conserva filas y solo modifica el esquema necesario de `sice_desarrollo`; no actualiza otras bases.
4. Ejecutar `npm run db:escolar` (también disponible como `npm run db:demo`). Carga 24 expedientes escolares y seis cuentas con nombres sintéticos naturales. Repetir la carga no crea duplicados ni restablece contraseñas.
5. Ejecutar `npm start`, abrir http://127.0.0.1:3000 e ingresar. El botón «Abrir panel institucional» lleva a `/panel.html`. Para desarrollo con reinicio: `npm run dev`.

En PowerShell con scripts deshabilitados, usar `npm.cmd`. `APP_ORIGIN` debe coincidir exactamente con el origen del navegador, incluido el puerto. El servidor verifica conexión y columnas necesarias antes de escuchar; si falta configuración o esquema, termina con un mensaje comprensible. `db:prepare` solo ejecuta DDL en bases nuevas; sobre una base existente verifica, sin borrar ni reparar a ciegas. El lector de DDL rechaza instrucciones `USE`, `CREATE DATABASE` o sentencias ajenas a CREATE/ALTER TABLE.

La base actual tiene **22 tablas**: las 19 del modelo escolar, dos técnicas de autenticación y una de autorizaciones concretas de cuentas. `involucrados` relaciona personas; los adultos no reciben matrículas ficticias. Se mantienen 187 columnas, 64 FK y 41 CHECK en las 19 tablas del esquema escolar.

## Cuentas de la colección escolar

Las contraseñas aleatorias están exclusivamente en `.env.escolar.local`, ignorado por Git, como `<ROL>_PASSWORD`. Abrir ese archivo localmente; ninguna herramienta imprime los valores.

| Usuario | Rol |
| --- | --- |
| `rsalazar` | Director |
| `mhuaman` | Subdirector |
| `jparedes` | Coordinador de Tutoría |
| `lramos` | Docente |
| `ctorres` | Auxiliar |
| `vgutierrez` | Administrador |

El Director o Subdirector autoriza un cambio concreto de cuenta o permiso. Un Administrador independiente lo ejecuta sin poder cambiar los datos autorizados. Se admite crear una cuenta para personal existente, actualizar rol/usuario/estado, restablecer contraseña y asignar/retirar permisos compatibles con el rol. No hay cambios sensibles sobre la propia cuenta ni autoasignación por rol; se revalidan autoridad, vigencia y estado del objetivo. La autorización vence en 24 horas, admite una sola ejecución y ambas etapas se auditan. Las contraseñas se proporcionan solo al crear/restablecer, se guardan con hash y nunca forman parte de la autorización ni del historial.

## Incidencias e informes

La matriz aplicada en desarrollo exige permiso específico por acción: D/SD pueden consultar internos y restringidos; Coordinador, internos; Docente/Auxiliar, internos registrados por ellos; Administrador, ningún expediente. Conflictos pendientes o inhibiciones bloquean al afectado. Los filtros se aplican también a búsquedas, detalle, versiones, seguimiento, historial y PDF. Los catálogos ofrecen identificación mínima y excluyen identidades de casos reservados a accesos sin permiso; no habilitan administrar personas ni catálogos escolares.

El registrador, su nombre histórico, rol y fechas de registro se obtienen de la sesión/servidor. El reportante se selecciona separadamente. Se guarda un borrador explícito, se revisa y se confirma. Al confirmar se validan los campos por categoría y el mínimo estudiantil configurado en el tipo; una incidencia admite cero, uno o varios estudiantes y también testigos adultos. Los hechos confirmados no se editan ni se eliminan físicamente. El seguimiento se agrega como actuación u observación; una corrección referencia la actuación anterior y conserva ambas.

Salud y Protección estudiantil se restringen automáticamente. En las demás categorías el registrador debe declarar la sensibilidad del contenido; no hay un clasificador automático de narrativas. Testigos confidenciales, presunta violencia u otra información sensible exigen marcar la reserva. Añadir seguimiento sensible eleva la protección en la misma transacción; quien pierda acceso recibe solo constancia. Esta interfaz no reduce confidencialidad.

El PDF requiere permiso de consulta y exportación y un expediente confirmado dentro del ámbito del usuario. Usa PDFKit, A4, blanco/guinda, logo original, siete secciones, código, emisión en hora de Lima y numeración de páginas. Firma y cargo corresponden a la identidad histórica del registrador, aunque descargue otro usuario. Solo se reservan espacios para firma y sello físicos; no se insertan firmas ni sellos falsos.

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

`test:mysql` utiliza exclusivamente `sice_desarrollo` y sus identidades sintéticas; conserva los expedientes de verificación y revierte los rechazos de integridad. No modifica `sice_pruebas` ni otras bases. El archivo `.env.integral.local` conserva únicamente una contraseña aleatoria de la cuenta creada durante la verificación. Las pruebas de acceso y gestión dejan auditoría real; repetirlas no limpia historial ni expedientes.

Con el servidor activo, `node test/interfaz-browser.js` comprueba Chrome a 320/768/1280 px y los flujos de acceso, registro, seguimiento y autorización/ejecución de cuentas. `TEST_BASE_URL` permite indicar otro origen local y `CHROME_PATH`, la ruta del navegador. Capturas y PDF de revisión se guardan únicamente en `.local/verificacion/`. PDF.js es una dependencia de desarrollo para inspeccionar páginas y contenido; PDFKit es la dependencia del servidor.

Resultados y colección: [database/DEMOSTRACION.md](database/DEMOSTRACION.md). Los 23 prototipos anteriores permanecen en SQL y fuera del panel escolar; los nuevos expedientes tienen contenido administrativo natural y un aviso de entorno separado. Ningún dato corresponde a personas reales del colegio.

## Organización

`public/` contiene interfaz y JavaScript vanilla; `src/`, servidor, reglas, rutas y consultas SQL separadas; `database/`, esquema, actualización y carga; `test/`, pruebas. Se conservan `image/` y el logo original. Sin ORM, React, Angular, TypeScript ni Docker.

Referencias técnicas: [PDFKit](https://pdfkit.org/docs/getting_started.html), [contraseñas de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) y [sesiones de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Las decisiones institucionales pendientes se mantienen en `PROJECT_CONTEXT.md` y los documentos de diseño/reglas de `database/`.
