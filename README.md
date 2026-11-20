# SICE-Local

Sistema local de registro, seguimiento e informes de incidencias escolares para la **I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete**, que atiende a estudiantes varones de primaria y secundaria.

Proyecto para revisión del instructor. Las reglas y formularios están implementados para desarrollo; requieren validación institucional antes de su uso en producción. Los módulos de gestión permanecen bloqueados fuera de desarrollo.

## Tecnologías y requisitos

- Node.js **24 o superior**, Express, mysql2 y MySQL Server **8** (verificado con 8.0.46).
- HTML5, CSS3, Bootstrap 5 y JavaScript vanilla. Bootstrap se sirve localmente.
- PDFKit para informes; `node:test`, Chrome y PDF.js para verificaciones.
- MySQL local en `127.0.0.1:3306` para los comandos de preparación. Chrome solo es necesario para las pruebas de interfaz.

## Funcionalidades implementadas

- Login, acceso directo al panel, sesiones revocables, expiración y cambio consecutivo de usuario.
- Seis roles, permisos verificados en el backend y restricciones por confidencialidad y conflicto de interés. El Administrador no accede a expedientes.
- Gestión de cuentas, solicitudes, decisiones independientes con contraseña y ejecución autorizada; historial de cambios.
- Seis categorías de incidencias, borradores, revisión y confirmación. Los hechos confirmados no se editan directamente ni se eliminan físicamente.
- Consulta con páginas de 20 registros y búsqueda por código, estudiante autorizado, fecha `dd/mm/aaaa` o título; filtros de categoría y estado.
- Actuaciones, observaciones, versiones, historial y PDF institucional con el logo original y espacios para firma y sello físicos.

Pendientes: solicitudes nuevas de rectificación/anulación de expedientes, revisión con acta, cierre/reapertura, administración de catálogos y procedimiento institucional ante desacuerdo, ausencia o conflicto de autoridades. También faltan definir acceso parcial, conservación y respaldos, y preparar HTTPS y privilegios SQL mínimos para producción. Los ejemplos precargados de estos procedimientos son datos, no flujos implementados.

## Instalación local

1. Clonar el [repositorio oficial](https://github.com/HugoDP19/PIM-Centro-de-Varones) y seleccionar la rama que se revisará (`develop` reúne los avances integrados).
2. Ejecutar `npm ci`.
3. Copiar `.env.example` a `.env`. Completar `DB_USER` y `DB_PASSWORD` con las credenciales de esa computadora y establecer `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_NAME=SICE` y `NODE_ENV=development`. Mantener `APP_ORIGIN=http://127.0.0.1:3000` si se usa el puerto predeterminado.
4. En una instalación nueva, ejecutar:

   ```text
   npm run db:prepare
   npm run db:escolar
   ```

   `db:prepare` crea las 22 tablas únicamente si `SICE` no existe. Sobre una base existente verifica el esquema, sin sobrescribir datos ni reparar incompatibilidades automáticamente. `db:escolar` carga explícitamente 24 expedientes sintéticos y seis cuentas; genera contraseñas aleatorias en `.env.escolar.local`. Repetir la carga no duplica expedientes ni restablece claves. En una instalación ya preparada, conservar sus cuentas y datos locales.

5. Ejecutar `npm start` y abrir **http://127.0.0.1:3000**. Para reiniciar automáticamente al editar código: `npm run dev`. En PowerShell con scripts deshabilitados, usar `npm.cmd`.

`APP_ORIGIN` debe coincidir con el origen y puerto del navegador. En desarrollo, la navegación entre `localhost` y `127.0.0.1` se normaliza al origen configurado. El servidor comprueba MySQL y el esquema antes de escuchar; no ejecuta cargas de datos al arrancar.

### Datos y cuentas de cada computadora

Cada instalación tiene su propia base `SICE`, contraseñas y expedientes sintéticos. Git no sincroniza MySQL: casa e instituto pueden tener datos distintos. No copiar `.env`, claves ni respaldos al repositorio y no recargar bases existentes para igualarlas.

Las cuentas de la carga escolar son:

| Usuario | Rol | Variable local de contraseña |
| --- | --- | --- |
| `rsalazar` | Director | `DIRECTOR_PASSWORD` |
| `mhuaman` | Subdirector | `SUBDIRECTOR_PASSWORD` |
| `jparedes` | Coordinador de Tutoría | `COORDINADOR_TUTORIA_PASSWORD` |
| `lramos` | Docente | `DOCENTE_PASSWORD` |
| `ctorres` | Auxiliar | `AUXILIAR_PASSWORD` |
| `hugodp19` | Administrador | `ADMINISTRADOR_PASSWORD` |

Consultar las claves solo en el archivo local `.env.escolar.local`. Si posteriormente se cambian usuarios, estados o claves, prevalecen los datos vigentes en MySQL. Las contraseñas nuevas requieren entre 8 y 12 caracteres, mayúscula, minúscula, número y signo; se almacenan con scrypt y sal individual.

Opcionalmente, `npm run db:escolar -- --completar-26` añade dos casos completos únicamente a la colección original de 24. Es una operación explícita, limitada al desarrollo local; si ya están los 26, no añade más. No usarla para normalizar datos entre computadoras.

Para una instalación anterior al flujo de solicitudes de cuentas, revisar el esquema y ejecutar `npm run db:cuentas` cuando corresponda. Actualiza la tabla de autorizaciones y permisos de gestión sin reemplazar expedientes. No es necesario en instalaciones nuevas preparadas con los scripts actuales.

## Verificación

```text
npm test
npm run db:check
npm run test:mysql
node test/interfaz-browser.js
```

- `npm test`: pruebas básicas de seguridad, configuración, HTTP y recursos de la interfaz.
- `db:check`: conexión real con las variables de `.env`.
- `test:mysql`: pruebas funcionales en una copia temporal propia `sice_test_<identificador>`, eliminada al terminar. Compara las 22 tablas de origen antes y después; no escribe en `SICE`.
- `interfaz-browser.js`: ejecuta la misma suite funcional y añade Chrome a 1280/1024/768 px. No es necesario ejecutar ambas variantes seguidas. `CHROME_PATH` permite indicar el ejecutable. Perfiles en el directorio temporal del sistema; PDF en memoria, sin capturas ni informes guardados en el proyecto.

La suite funcional requiere la colección escolar original de 24 o su ampliación a 26, las credenciales vigentes en `.env.escolar.local` y permisos MySQL para crear/eliminar su copia temporal. No es una prueba genérica para cualquier colección modificada. Detener el servidor principal durante esa verificación: la actividad normal de sesiones alteraría la comparación de integridad. Las cuentas se habilitan solo en la copia para comprobar los seis roles; su estado original se conserva.

## Organización y seguridad

| Ruta | Contenido |
| --- | --- |
| `public/` | HTML, CSS y JavaScript de la interfaz |
| `src/` | Servidor, autenticación, reglas y consultas parametrizadas |
| `database/` | Esquema, preparación, actualización y carga sintética explícita |
| `test/` | Pruebas automatizadas |
| `image/` | Logo institucional original |

Las sesiones se guardan revocables en MySQL; cookies `HttpOnly` y `SameSite`, protección de origen para escrituras y revalidación de permisos en cada petición. Caducan a las 8 horas o tras 30 minutos de inactividad. Ningún permiso configurable permite al Administrador acceder a expedientes.

`.gitignore` excluye configuraciones privadas, dependencias instaladas, respaldos y resultados temporales. Conservar `.env.example` sin credenciales. Los scripts SQL de instalación, pruebas, documentos técnicos e imágenes necesarias sí se versionan.

Consultar [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) para avances y verificaciones, y [diseño](database/DISENO.md) y [reglas funcionales](database/REGLAS_FUNCIONALES.md) para las decisiones institucionales y sus límites. El historial distingue las propuestas iniciales de lo implementado posteriormente.
