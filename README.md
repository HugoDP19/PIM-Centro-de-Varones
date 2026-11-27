# SICE-Local

Registro, seguimiento e informes de incidencias escolares de la **I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete**.

Node.js 24 o superior, Express, **SQL Server 2022** y mssql. Interfaz HTML/CSS, Bootstrap 5 y JavaScript vanilla; informes con PDFKit.

## Ejecución local

1. Instalar las dependencias con `npm ci`.
2. Copiar `.env.example` a `.env` solo si no existe. Completar DB_HOST, DB_USER y DB_PASSWORD localmente; DB_PORT=1433 y DB_NAME=SICE. No compartir claves.
3. Ejecutar:

```text
npm run db:check
npm run db:prepare
npm start
```

En PowerShell puede usarse `npm.cmd`. Abrir http://127.0.0.1:3000. APP_ORIGIN debe coincidir con esa dirección. `db:prepare` **solo verifica** el esquema; no carga datos ni modifica tablas.

DB_ENCRYPT=true cifra la conexión. DB_TRUST_CERTIFICATE=true permite el certificado de la instancia local; usar false cuando exista un certificado confiable. Las rutas de gestión requieren actualmente NODE_ENV=development por los pendientes institucionales descritos abajo.

## Instalación y SSMS 22

Conectar al motor `tcp:127.0.0.1,1433` con autenticación de Windows autorizada o una cuenta SQL. Para esta instancia local, seleccionar **Confiar en el certificado del servidor**. Abrir **Bases de datos > SICE > Tablas**.

En una instalación nueva, ejecutar `database/crear-base.sql` y después `database/schema.sql`, seleccionando SICE y comprobando antes que no tenga tablas. El esquema contiene **22 tablas, 225 columnas, 76 claves foráneas y 148 CHECK**, con texto Unicode e intercalación Latin1_General_100_CI_AI_SC. No repetirlo sobre una base instalada.

La cuenta SQL de aplicación debe tener SELECT/INSERT en dbo, UPDATE en cada tabla salvo historial y DELETE únicamente en sesiones, intentos_acceso y roles_permisos. Sin DDL, administración ni acceso a otras bases; no usar una cuenta administrativa en `.env`. En esta computadora esos permisos ya están configurados. Los roles de la aplicación no limitan una conexión técnica independiente de SSMS.

El esquema vacío no crea personal, cuentas ni catálogos. Su provisión inicial con identidades institucionales y hashes seguros sigue pendiente de un procedimiento de instalación; **no usar fixtures para instalar el sistema del colegio**.

## Funciones disponibles

- Seis roles: Director, Subdirector, Coordinador de Tutoría, Docente, Auxiliar y Administrador.
- Inicio/cierre de sesión, caducidad, revocación y permisos comprobados en el servidor.
- Cuentas y permisos con autorización independiente, recíproca o doble según el cambio; sin autoaprobación.
- Estudiantes y matrícula por Director, Subdirector y Coordinador de Tutoría.
- Seis categorías de incidencias, borradores sin duplicar reintentos, confirmación, búsqueda, seguimiento con plazos y versiones. Selectores de personas con búsqueda y paginación.
- Rectificación documental, anulación lógica por duplicado, cierre y reapertura motivados.
- PDF autorizado con logo, autoría histórica, firma y sello. Administrador sin expedientes ni PDF escolares.

La base local conserva seis cuentas activas, tres estudiantes y seis borradores sintéticos de presentación. Las claves permanecen en el archivo privado existente. Para exportar un borrador hay que completar sus campos y confirmarlo. No trasladar estos registros a una instalación con información real. El servidor nunca carga datos sintéticos.

## Lectura del código

Para sustentar un flujo, sigue este orden: formulario en `public/js/`, ruta y validaciones en `src/`, consultas en `src/consultas-*.js` y evidencia en `test/`. Las rutas comprueban la sesión y el permiso antes de trabajar; las escrituras sensibles vuelven a comprobarlos dentro de una transacción.

En `cuentas.js`, las validaciones de cuenta, permiso y solicitante están separadas. En `incidencias.js`, cada grupo de campos tiene su validación; `cambios-incidencias.js` distingue la revisión documental de la formal. `database.js` vincula los parámetros SQL y confirma o revierte la operación completa. Las funciones permanecen en los archivos actuales, sin capas adicionales.

## Pruebas

```text
npm test
npm run test:sqlserver
node test/interfaz-browser.js
```

La última orden incluye la integración y añade Chrome a 1280/1024/768 px. Requiere Chrome y sqlcmd con autenticación de Windows autorizada para crear una base y cuenta temporales. SQLCMD_PATH, DB_SETUP_SERVER y CHROME_PATH permiten indicar ubicaciones locales.

La colección de `test/datos.js` solo admite bases temporales. La suite comprueba los seis roles, decisiones, privacidad, integridad, PDF y persistencia tras reiniciar el servidor; compara SICE antes/después y elimina únicamente sus recursos tras verificar su identidad. No utilizar simultáneamente SICE durante esa comparación. No guarda capturas ni PDF.

Revisión de legibilidad del 26 de noviembre de 2026: **7 pruebas básicas y 59 de integración/Chrome aprobadas, cero fallidas**; conserva las 66 comprobaciones anteriores y SICE sin cambios. También se ejecutó `npm run test:sqlserver`: 50 aprobadas, incluidas en la cobertura anterior. La validación final se repitió después de liberar memoria por esperas agotadas en SQL Server y Chrome, sin modificar las pruebas. Tras actualizar el código, reiniciar Node para cargar el backend revisado.

Resultados y pendientes de la revisión: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md). Modelo: [database/DISENO.md](database/DISENO.md). Reglas: [database/REGLAS_FUNCIONALES.md](database/REGLAS_FUNCIONALES.md).

## Antes de instalar en el colegio

Faltan composición y quórum de revisión formal con acta, resolución de desacuerdos/doble impedimento, gestión general de catálogos y provisión institucional inicial. La aprobación formal permanece bloqueada. También faltan validación institucional, política de conservación/respaldos y despliegue HTTPS; las rutas de gestión devuelven 503 en producción. Las pruebas aprobadas no sustituyen estos pendientes.
