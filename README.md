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
- Registro, búsqueda y edición de estudiantes y apoderados por Director, Subdirector y Coordinador de Tutoría; matrículas y vínculos principales con historial.
- Seis categorías de incidencias, borradores sin duplicar reintentos, confirmación, búsqueda, seguimiento con plazos y versiones. Selectores de personas con búsqueda y paginación.
- Rectificación documental, anulación lógica por duplicado, cierre y reapertura motivados.
- PDF autorizado con logo, autoría histórica, firma y sello. Administrador sin expedientes ni PDF escolares.

La base local conserva seis cuentas activas, tres estudiantes y seis borradores sintéticos de presentación. Las claves permanecen en el archivo privado existente. Para exportar un borrador hay que completar sus campos y confirmarlo. No trasladar estos registros a una instalación con información real. El servidor nunca carga datos sintéticos.

## Estudiantes y apoderados

1. Entra con un rol autorizado y abre **Estudiantes y apoderados**. Busca por nombre, documento o código; el filtro de grado corresponde a la matrícula vigente.
2. Registra al estudiante con código único. Selecciona año/nivel, grado y sección de las aulas activas; indica la fecha de inicio y confirma con tu contraseña.
3. El documento es opcional: DNI peruano de ocho dígitos, carnet de extranjería de 9–12 letras/números o pasaporte de 3–40 letras/números. Selecciona el país emisor. Estas son validaciones de formato, no una consulta a registros oficiales. Sin documento conocido, se conserva la identidad provisional mediante el código; no se inventa DNI.
4. Abre **Consultar y editar** para actualizar la ficha. El código permanece estable. Una identidad usada en expedientes, cuentas o revisiones conserva nombres, documento y nacimiento; se permite actualizar contacto. Las correcciones de identidad histórica requieren un procedimiento institucional fuera de este formulario.
5. Busca al apoderado antes de crear otra persona. Puede representar a varios estudiantes; el personal existente se selecciona y asocia antes de editarlo como apoderado. Completa vínculo, fecha y contraseña para guardar al principal. Crear un apoderado no crea una cuenta.
6. Para cambiar de aula, registra una nueva matrícula desde la ficha. Se conserva la anterior y se finaliza el día previo. No se admite retroceder sobre fechas de hechos ya vinculados a esa matrícula.

Los cambios de matrícula y principal requieren un inicio posterior al anterior, sin períodos superpuestos. Las fechas tienen precisión de día: una segunda sustitución el mismo día se rechaza para no reescribir el historial. Los documentos se normalizan a mayúsculas y la base impide duplicar país/tipo/número; sin documento, la revisión humana evita duplicar personas con nombres semejantes. No hay fusión ni eliminación de identidades.

El permiso existente `estudiantes.crear` controla toda esta gestión para D/SD/CT. Administrador, Docente y Auxiliar no acceden a estas rutas. La reserva escolar también filtra resultados, contadores, fichas y apoderados compartidos. No se crean tablas, permisos ni dependencias.

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

Verificación de gestión escolar del 27 de noviembre de 2026: **7 pruebas básicas y 76 de integración/Chrome aprobadas, cero fallidas**. Son las 66 comprobaciones anteriores y 17 nuevas. La ejecución SQL independiente aprobó **63/63**: las 50 anteriores y 13 nuevas, incluidas también en la suite con Chrome. Los formularios nuevos se comprobaron a 1280/768/375 px. SICE permaneció sin cambios y se retiraron las bases, cuentas y perfiles temporales.

Los escenarios nuevos se ejecutan después de los anteriores para no cambiar sus datos de referencia. Antes del nuevo bloque SQL se simula otra ventana de reautenticación exclusivamente en la base temporal identificada; la prueba previa conserva la comprobación del bloqueo 429. No se alteraron los límites de la aplicación ni las aserciones existentes.

El servidor local quedó reiniciado en http://127.0.0.1:3000 con SQL Server 2022 y la versión actual. Se compararon las 22 tablas durante el reinicio: sin cambios; no había registros técnicos caducados que retirar.

Resultados y pendientes de la revisión: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md). Modelo: [database/DISENO.md](database/DISENO.md). Reglas: [database/REGLAS_FUNCIONALES.md](database/REGLAS_FUNCIONALES.md).

## Antes de instalar en el colegio

Faltan composición y quórum de revisión formal con acta, resolución de desacuerdos/doble impedimento, gestión general de catálogos y provisión institucional inicial. La aprobación formal permanece bloqueada. También faltan validación institucional, política de conservación/respaldos y despliegue HTTPS; las rutas de gestión devuelven 503 en producción. Las pruebas aprobadas no sustituyen estos pendientes.
