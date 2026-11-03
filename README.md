# SICE-Local

Sistema de registro y seguimiento de incidencias escolares de la I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete.

Estado: conexión real a MySQL 8, autenticación y demostración local preparadas. La interfaz permite iniciar sesión, consultar la sesión y cerrarla. Los módulos de expedientes y administración de cuentas siguen pendientes; sus rutas no están habilitadas.

## Instalación local

Requiere Node.js 24 o superior y MySQL 8.0.16 o superior. Validado con MySQL 8.0.46.

1. Ejecutar `npm ci`.
2. Crear `.env` desde `.env.example` y completar la contraseña local, sin compartirla ni versionarla. Para esta demostración: `NODE_ENV=development`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_NAME=sice_desarrollo` y un usuario SQL autorizado para preparar esa base.
3. Ejecutar `npm run db:prepare`. Crea la base solo si no existe; si existe, verifica sin reejecutar el esquema. No borra datos ni repara automáticamente un esquema parcial.
4. Ejecutar `npm run db:demo` para cargar los ejemplos sintéticos y las seis cuentas de desarrollo. Consultar las contraseñas solo en `.env.demo.local`, excluido de Git; nunca se imprimen.
5. Ejecutar `npm start` y abrir http://127.0.0.1:3000. Para desarrollo con reinicio automático: `npm run dev`.

En PowerShell con scripts deshabilitados, usar `npm.cmd`. No es necesario cambiar la política de ejecución. `APP_ORIGIN` debe coincidir exactamente con el origen abierto en el navegador, incluido el puerto; para la configuración predeterminada, usar `127.0.0.1`.

El servidor comprueba MySQL y las tablas técnicas antes de escuchar. Si falta configuración, conexión o esquema, termina con un mensaje comprensible. `/api/health` indica disponibilidad HTTP; no sustituye `npm run db:check` ni verifica periódicamente MySQL.

## Autenticación

| Ruta | Comportamiento |
| --- | --- |
| `POST /api/auth/login` | Recibe `usuario` y `contrasena`; valida la cuenta, crea una sesión nueva y rota la cookie anterior. |
| `GET /api/auth/sesion` | Devuelve identidad, rol y permisos efectivos; 401 sin sesión o si está vencida. |
| `POST /api/auth/logout` | Revoca la sesión en MySQL, registra el cierre y elimina la cookie. |

Las peticiones POST requieren JSON, `Origin` igual a `APP_ORIGIN` y `X-SICE-Request: 1`; la interfaz los envía. No se habilita CORS. Sesiones aleatorias de 256 bits, con solo SHA-256 del token en MySQL, duración absoluta de 8 horas e inactividad máxima de 30 minutos. Cookies `HttpOnly`, `SameSite=Strict` y `Secure` en producción. No se guardan credenciales ni tokens en localStorage.

Contraseñas con scrypt (`N=131072`, `r=8`, `p=1`) y sal aleatoria individual. Mensaje genérico para usuario inexistente o contraseña incorrecta. Límites persistidos: 10 intentos por cuenta y 100 por IP en 15 minutos. Un acceso correcto reinicia el contador de la cuenta. Se auditan accesos correctos, rechazos de cuentas conocidas y cierres, sin contraseñas ni tokens en el historial.

Cada consulta de sesión revalida cuenta, persona, hash de contraseña, rol y permisos en MySQL. La revocación de permisos produce 403 sin reiniciar el servidor. La lista de permisos efectivos es cerrada: `sesion.consultar` para los seis roles, `cuentas.administrar` exclusivamente para Administrador y `cuentas.autorizar` para Director/Subdirector, siempre que exista la concesión en la base. Estos últimos identifican límites técnicos y no habilitan todavía operaciones de administración.

Los permisos configurables nunca habilitan expedientes al Administrador. En esta fase, `/api/incidencias` devuelve 401 sin autenticación y 403 para cualquier usuario autenticado. La prueba de protección no sustituye las futuras reglas de lectura por expediente ni los flujos de modificación.

Producción exige `APP_ORIGIN=https://...`; configurar `TRUST_PROXY_LOCAL=1` solo detrás de un proxy HTTPS local de confianza. El proyecto no instala certificados, proxy ni usuarios SQL de producción. La cuenta local usada para preparar el esquema no representa una configuración de privilegios mínimos para despliegue.

Criterios técnicos: [hash de contraseñas de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) y [gestión de sesiones de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Demostración y pruebas

Ver [database/DEMOSTRACION.md](database/DEMOSTRACION.md) para las cuentas, los 23 expedientes cargados, los escenarios preparados y sus límites. [database/consultar-demo.sql](database/consultar-demo.sql) permite revisarlos en Workbench. El escenario del testigo adulto queda documentado hasta resolver el límite del modelo.

```text
npm test
npm run db:check
npm run test:mysql
```

`npm test` ejecuta pruebas HTTP y de seguridad sin simular MySQL. `test:mysql` requiere la conexión real: crea/verifica exclusivamente `sice_pruebas`, prepara datos sintéticos si está vacía y conserva sus credenciales en `.env.pruebas.local`. No limpia expedientes; las comprobaciones de integridad se revierten y las pruebas de acceso dejan eventos de auditoría reales. No ejecutar contra producción.

Con `npm start` activo, `node test/interfaz-browser.js` verifica Chrome a 320, 768 y 1280 px y el flujo de login/recarga/logout. Usa Chrome instalado; `CHROME_PATH` permite indicar su ruta. Guarda capturas en `.local/verificacion/` y no imprime las contraseñas demo. La prueba requiere los datos de desarrollo locales.

## Organización

- `public/`: login y panel de sesión, Bootstrap 5 y JavaScript vanilla.
- `image/`: logo original conservado; se sirve como `/image/images.jpg`.
- `src/database.js`: pool mysql2/promise y comprobación de conexión.
- `src/seguridad.js`: hash y límites de permisos; `consultas-auth.js`: SQL parametrizado; `autenticacion.js`: sesión y rutas de acceso.
- `src/app.js` y `server.js`: aplicación HTTP, recursos y arranque comprobado.
- `database/schema.sql`: las 19 tablas escolares sin cambios. `autenticacion.sql`: dos tablas técnicas necesarias, sesiones e intentos de acceso.
- `database/preparar.js`, `cargar-demo.js` y `casos-demo.js`: preparación segura y carga transaccional reproducible.
- `test/`: pruebas básicas, integración MySQL y verificación de navegador.

Sin ORM, frameworks de interfaz ni nuevas dependencias de autenticación. Bootstrap se sirve desde el paquete local. El diseño y las reglas institucionales pendientes se conservan en `database/DISENO.md`, `database/REGLAS_FUNCIONALES.md` y `PROJECT_CONTEXT.md`.
